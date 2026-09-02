/**
 * Creates the metafield definitions from definitions/metafields.js.
 *
 * Runs after the metaobjects, because `metaobject_reference` fields need a real
 * MetaobjectDefinition gid in their validations. The `typeToGid` map produced by
 * pushMetaobjects is passed in; anything missing from it is looked up in the
 * store, so `push --only=metafields` still works as long as the metaobjects were
 * created by an earlier run.
 *
 * Idempotent: an existing namespace+key on the same ownerType is skipped, never
 * updated. Shopify also guards this server-side with a TAKEN userError, which is
 * treated as a skip rather than a failure.
 */

import { formatUserErrors } from './client.js';
import { log, c } from './logger.js';
import { metafieldDefinitions, OWNER_TYPES, NAMESPACE } from './definitions/metafields.js';
import { fetchExistingMetaobjectDefinitions } from './push-metaobjects.js';

/* ------------------------------------------------------------------ *
 * GraphQL documents
 * ------------------------------------------------------------------ */

const LIST_QUERY = `
  query MetafieldDefinitions($first: Int!, $after: String, $ownerType: MetafieldOwnerType!, $namespace: String) {
    metafieldDefinitions(first: $first, after: $after, ownerType: $ownerType, namespace: $namespace) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        namespace
        key
        type { name }
        validations { name value }
      }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name namespace key }
      userErrors { field message code }
    }
  }
`;

/* ------------------------------------------------------------------ *
 * Reading what already exists
 * ------------------------------------------------------------------ */

export async function fetchExistingMetafieldDefinitions(client, ownerType, namespace = NAMESPACE) {
  return client.paginate(
    LIST_QUERY,
    { ownerType, namespace },
    (data) => data.metafieldDefinitions,
    { label: `metafieldDefinitions(${ownerType})`, pageSize: 100 }
  );
}

/* ------------------------------------------------------------------ *
 * Input building
 * ------------------------------------------------------------------ */

function resolveValidations(validations = [], typeToGid) {
  const resolved = [];
  const unresolved = [];
  for (const validation of validations) {
    if (!validation.metaobjectType) {
      resolved.push({ name: validation.name, value: validation.value });
      continue;
    }
    const gid = typeToGid.get(validation.metaobjectType);
    if (!gid) unresolved.push(validation.metaobjectType);
    else resolved.push({ name: validation.name, value: gid });
  }
  return { resolved, unresolved };
}

/** Ensure every metaobject type referenced by the selected metafields has a gid. */
async function ensureReferencedTypes(client, definitions, typeToGid) {
  const needed = new Set();
  for (const definition of definitions) {
    for (const validation of definition.validations ?? []) {
      if (validation.metaobjectType && !typeToGid.has(validation.metaobjectType)) {
        needed.add(validation.metaobjectType);
      }
    }
  }
  if (!needed.size) return typeToGid;

  log.dim(`resolving metaobject reference(s): ${[...needed].join(', ')}`);
  const nodes = await fetchExistingMetaobjectDefinitions(client);
  for (const node of nodes) {
    if (!typeToGid.has(node.type)) typeToGid.set(node.type, node.id);
  }
  return typeToGid;
}

/* ------------------------------------------------------------------ *
 * Push
 * ------------------------------------------------------------------ */

export async function pushMetafields(
  client,
  { dryRun = false, only = null, typeToGid = new Map(), pin = true } = {}
) {
  log.step(dryRun ? 'Metafield definitions (dry run)' : 'Metafield definitions');

  const selected = metafieldDefinitions.filter((d) => matchesOnly(d, only));
  if (!selected.length) {
    log.dim('nothing selected');
    return [];
  }

  await ensureReferencedTypes(client, selected, typeToGid);

  const results = [];

  for (const ownerType of OWNER_TYPES) {
    const forOwner = selected.filter((d) => d.ownerType === ownerType);
    if (!forOwner.length) continue;

    log.blank();
    log.group(`${ownerType} · namespace "${NAMESPACE}"`);

    const existingNodes = await fetchExistingMetafieldDefinitions(client, ownerType);
    const existingKeys = new Set(
      existingNodes.filter((n) => n.namespace === NAMESPACE).map((n) => n.key)
    );

    for (const definition of forOwner) {
      const label = `${c.grey(ownerType.toLowerCase() + '.')}${c.bold(definition.key)}`;

      if (existingKeys.has(definition.key)) {
        log.result('SKIP', label, 'exists');
        results.push({ kind: 'metafield', label: `${ownerType}.${definition.key}`, status: 'skipped' });
        continue;
      }

      const { resolved, unresolved } = resolveValidations(definition.validations, typeToGid);
      if (unresolved.length) {
        const detail = `needs metaobject definition "${unresolved.join(', ')}" — run "push --only=metaobjects" first`;
        log.result('FAIL', label, detail);
        results.push({
          kind: 'metafield',
          label: `${ownerType}.${definition.key}`,
          status: 'failed',
          detail,
        });
        continue;
      }

      const input = {
        name: definition.name,
        namespace: definition.namespace,
        key: definition.key,
        type: definition.type,
        ownerType: definition.ownerType,
        access: { storefront: 'PUBLIC_READ' },
      };
      if (definition.description) input.description = definition.description;
      if (resolved.length) input.validations = resolved;
      // Pinned definitions show up directly on the admin edit screen, which is
      // the whole point for a catalogue the team fills in by hand.
      if (pin) input.pin = true;

      if (dryRun) {
        log.result('PLAN', label, `create ${definition.type}`);
        results.push({ kind: 'metafield', label: `${ownerType}.${definition.key}`, status: 'planned' });
        continue;
      }

      const outcome = await createMetafieldDefinition(client, input, label);
      results.push({ kind: 'metafield', label: `${ownerType}.${definition.key}`, ...outcome });
    }
  }

  return results;
}

async function createMetafieldDefinition(client, input, label, allowPinRetry = true) {
  try {
    const data = await client.request(
      CREATE_MUTATION,
      { definition: input },
      { label: `metafieldDefinitionCreate(${input.ownerType}.${input.key})` }
    );
    const payload = data.metafieldDefinitionCreate;
    const userErrors = payload.userErrors ?? [];

    if (userErrors.length) {
      // The admin caps how many definitions can be pinned per owner type.
      // Losing the pin is cosmetic, so retry unpinned rather than fail.
      if (allowPinRetry && input.pin && userErrors.some((e) => e.code === 'PINNED_LIMIT_REACHED')) {
        log.warn(`${label}: pinned limit reached, creating unpinned`);
        return createMetafieldDefinition(client, { ...input, pin: false }, label, false);
      }
      // Already exists (created outside this script, or a concurrent run).
      if (userErrors.every((e) => e.code === 'TAKEN')) {
        log.result('SKIP', label, 'exists (reported by Shopify)');
        return { status: 'skipped' };
      }
      const detail = formatUserErrors(userErrors);
      log.result('FAIL', label, '');
      log.error(`         ${detail}`);
      return { status: 'failed', detail };
    }

    const created = payload.createdDefinition;
    log.result('CREATE', label, `${input.type} · ${created.id.split('/').pop()}`);
    return { status: 'created' };
  } catch (error) {
    log.result('FAIL', label, error.message);
    return { status: 'failed', detail: error.message };
  }
}

/**
 * `--only` accepts `metafields`, `all`, an owner type (`product`, `collection`,
 * `page`), a bare key (`designer`), or a qualified key (`product.designer`).
 */
function matchesOnly(definition, only) {
  if (!only || !only.length) return true;
  const owner = definition.ownerType.toLowerCase();
  return only.some(
    (token) =>
      token === 'all' ||
      token === 'metafields' ||
      token === owner ||
      token === definition.key ||
      token === `${owner}.${definition.key}`
  );
}
