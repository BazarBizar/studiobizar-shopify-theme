/**
 * Creates the metaobject definitions from definitions/metaobjects.js.
 *
 * Two passes, because of dependency order:
 *
 *   Pass 1 — walk the definitions top to bottom. Each one is created with only
 *            the fields whose references can already be resolved, and its gid
 *            goes into `typeToGid`. Fields that reference a definition which
 *            does not have a gid yet (notably `project.related_projects`,
 *            which points at `project` itself) are held back.
 *
 *   Pass 2 — every gid is now known, so the held-back fields are appended with
 *            metaobjectDefinitionUpdate. This is purely additive: it only ever
 *            sends `{ create: ... }` operations for keys that are missing, and
 *            never touches or deletes an existing field.
 *
 * Nothing here overwrites data. A definition that already exists is skipped.
 */

import { formatUserErrors } from './client.js';
import { log, c } from './logger.js';
import { metaobjectDefinitions } from './definitions/metaobjects.js';

/* ------------------------------------------------------------------ *
 * GraphQL documents
 * ------------------------------------------------------------------ */

const LIST_QUERY = `
  query MetaobjectDefinitions($first: Int!, $after: String) {
    metaobjectDefinitions(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        type
        name
        capabilities {
          publishable { enabled }
          renderable { enabled data { metaTitleKey metaDescriptionKey } }
          onlineStore { enabled data { urlHandle } }
        }
        fieldDefinitions {
          key
          name
          required
          type { name }
          validations { name value }
        }
      }
    }
  }
`;

/** Fallback without `capabilities`, in case that selection is unavailable. */
const LIST_QUERY_MINIMAL = `
  query MetaobjectDefinitions($first: Int!, $after: String) {
    metaobjectDefinitions(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        type
        name
        fieldDefinitions { key name required type { name } validations { name value } }
      }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type name }
      userErrors { field message code }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateMetaobjectDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message code }
    }
  }
`;

/* ------------------------------------------------------------------ *
 * Reading what already exists
 * ------------------------------------------------------------------ */

export async function fetchExistingMetaobjectDefinitions(client) {
  const pick = (data) => data.metaobjectDefinitions;
  try {
    return await client.paginate(LIST_QUERY, {}, pick, {
      label: 'metaobjectDefinitions',
      pageSize: 50,
    });
  } catch (error) {
    // `capabilities` selection unsupported on this API version — retry leaner.
    log.dim('falling back to a minimal metaobjectDefinitions query');
    return client.paginate(LIST_QUERY_MINIMAL, {}, pick, {
      label: 'metaobjectDefinitions',
      pageSize: 50,
    });
  }
}

/** type -> { id, fieldKeys:Set, node } for everything already in the store. */
export function indexByType(nodes) {
  const map = new Map();
  for (const node of nodes) {
    map.set(node.type, {
      id: node.id,
      fieldKeys: new Set((node.fieldDefinitions ?? []).map((f) => f.key)),
      node,
    });
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Input building
 * ------------------------------------------------------------------ */

/**
 * Swaps `{ name:'metaobject_definition_id', metaobjectType:'x' }` placeholders
 * for real gids. Returns the resolved list plus any types still unknown.
 */
function resolveValidations(validations = [], typeToGid) {
  const resolved = [];
  const unresolved = [];
  for (const validation of validations) {
    if (!validation.metaobjectType) {
      resolved.push({ name: validation.name, value: validation.value });
      continue;
    }
    const gid = typeToGid.get(validation.metaobjectType);
    if (!gid) {
      unresolved.push(validation.metaobjectType);
      continue;
    }
    resolved.push({ name: validation.name, value: gid });
  }
  return { resolved, unresolved };
}

function buildFieldInput(field, typeToGid) {
  const { resolved, unresolved } = resolveValidations(field.validations, typeToGid);
  const input = { key: field.key, name: field.name, type: field.type };
  if (field.description) input.description = field.description;
  if (field.required) input.required = true;
  if (resolved.length) input.validations = resolved;
  return { input, unresolved };
}

/**
 * Expands the shorthand in metaobjects.js into a capabilities payload.
 *
 *   publishable -> draft/active status on entries
 *   renderable  -> SEO fields in Liquid + inclusion in the sitemap
 *   onlineStore -> entries get a URL at /pages/{urlHandle}/{entry-handle},
 *                  rendered by templates/metaobject/{type}.json
 *
 * `createRedirects` is deliberately not sent — it is not part of the documented
 * onlineStore data input.
 */
function buildCapabilities(definition) {
  const capabilities = {};
  if (definition.publishable) capabilities.publishable = { enabled: true };
  if (definition.renderable) {
    capabilities.renderable = {
      enabled: true,
      data: {
        metaTitleKey: definition.renderable.metaTitleKey,
        metaDescriptionKey: definition.renderable.metaDescriptionKey,
      },
    };
  }
  if (definition.onlineStore) {
    capabilities.onlineStore = {
      enabled: true,
      data: { urlHandle: definition.onlineStore.urlHandle },
    };
  }
  return Object.keys(capabilities).length ? capabilities : null;
}

/**
 * Compares the capabilities we want against what the store already has.
 * Returns only the parts that need turning on — enabling a capability is
 * additive and does not touch entry data, but we still never send a capability
 * that is already in the desired state.
 */
function capabilityDrift(definition, node) {
  const desired = buildCapabilities(definition);
  if (!desired) return null;
  const current = node.capabilities ?? {};
  const patch = {};

  if (desired.publishable && !current.publishable?.enabled) {
    patch.publishable = desired.publishable;
  }
  if (desired.renderable && !current.renderable?.enabled) {
    patch.renderable = desired.renderable;
  }
  if (desired.onlineStore) {
    const currentHandle = current.onlineStore?.data?.urlHandle;
    if (!current.onlineStore?.enabled || currentHandle !== desired.onlineStore.data.urlHandle) {
      patch.onlineStore = desired.onlineStore;
    }
  }

  return Object.keys(patch).length ? patch : null;
}

/** Input keys that may not exist on every API version; droppable on rejection. */
const OPTIONAL_INPUT_KEYS = ['access', 'capabilities', 'description', 'displayNameKey'];

function findRejectedInputKey(message) {
  if (!/not defined|unknown field|unknown argument|doesn't accept|is not an input|isn't accepted/i.test(message)) {
    return null;
  }
  return OPTIONAL_INPUT_KEYS.find((key) => new RegExp(`["'\`]${key}["'\`]`).test(message)) ?? null;
}

/* ------------------------------------------------------------------ *
 * Push
 * ------------------------------------------------------------------ */

/**
 * @returns {Promise<{ results: Array, typeToGid: Map<string,string> }>}
 */
export async function pushMetaobjects(client, { dryRun = false, only = null, patch = true } = {}) {
  log.step(dryRun ? 'Metaobject definitions (dry run)' : 'Metaobject definitions');

  const existingNodes = await fetchExistingMetaobjectDefinitions(client);
  const existing = indexByType(existingNodes);

  // Seed the gid map with everything already in the store, so a partial run
  // (or --only) can still resolve references to definitions created earlier.
  const typeToGid = new Map();
  for (const [type, entry] of existing) typeToGid.set(type, entry.id);

  const selected = metaobjectDefinitions.filter((d) => matchesOnly(d, only));
  if (!selected.length) {
    log.dim('nothing selected');
    return { results: [], typeToGid };
  }

  const results = [];
  /** Fields held back for pass 2: { definition, id, fields: [...] } */
  const pending = [];
  /** Capabilities to switch on for definitions that already exist. */
  const capabilityPatches = [];

  /* ---------------- Pass 1: create / skip ---------------- */
  for (const definition of selected) {
    const label = `${c.bold(definition.type)}`;
    const already = existing.get(definition.type);

    if (already) {
      // Idempotent: never overwrite. Only note fields that are entirely absent.
      const missing = definition.fields.filter((f) => !already.fieldKeys.has(f.key));
      log.result('SKIP', label, `exists · ${already.fieldKeys.size} fields`);
      results.push({ kind: 'metaobject', label: definition.type, status: 'skipped' });
      if (missing.length && patch) {
        pending.push({ definition, id: already.id, fields: missing, reason: 'missing on existing definition' });
      } else if (missing.length) {
        log.dim(`  ${missing.length} field(s) missing; re-run without --no-patch to add them`);
      }

      // Turning a capability on is additive — it never touches entry data — but
      // it does change storefront URLs, so it is reported explicitly.
      const drift = capabilityDrift(definition, already.node);
      if (drift && patch) {
        capabilityPatches.push({ definition, id: already.id, capabilities: drift });
      } else if (drift) {
        log.dim(`  capabilities out of date (${Object.keys(drift).join(', ')}); re-run without --no-patch`);
      }
      continue;
    }

    // Hold back any field whose reference cannot be resolved yet — this is
    // where project.related_projects (self-reference) drops out.
    const createFields = [];
    const deferredFields = [];
    let blocked = null;

    for (const field of definition.fields) {
      if (field.deferred) {
        deferredFields.push(field);
        continue;
      }
      const { input, unresolved } = buildFieldInput(field, typeToGid);
      if (unresolved.length) {
        // Referenced type will exist later in this run -> defer.
        // Referenced type is not in this run at all -> hard failure.
        const comingLater = unresolved.every((t) =>
          selected.some((d) => d.type === t && d !== definition)
        );
        if (comingLater) {
          deferredFields.push(field);
        } else {
          blocked = `field "${field.key}" needs metaobject definition "${unresolved.join(', ')}" which does not exist and is not part of this run`;
          break;
        }
        continue;
      }
      createFields.push(input);
    }

    if (blocked) {
      log.result('FAIL', label, blocked);
      results.push({ kind: 'metaobject', label: definition.type, status: 'failed', detail: blocked });
      continue;
    }

    const input = {
      type: definition.type,
      name: definition.name,
      fieldDefinitions: createFields,
      access: { storefront: 'PUBLIC_READ' },
    };
    if (definition.description) input.description = definition.description;
    if (definition.displayNameKey) input.displayNameKey = definition.displayNameKey;
    const capabilities = buildCapabilities(definition);
    if (capabilities) input.capabilities = capabilities;

    if (dryRun) {
      const extra = deferredFields.length
        ? ` (+${deferredFields.length} deferred: ${deferredFields.map((f) => f.key).join(', ')})`
        : '';
      log.result('PLAN', label, `create with ${createFields.length} fields${extra}`);
      results.push({ kind: 'metaobject', label: definition.type, status: 'planned' });
      // Pretend it exists so later definitions in the plan resolve cleanly.
      typeToGid.set(definition.type, `gid://shopify/MetaobjectDefinition/DRY-${definition.type}`);
      if (deferredFields.length) {
        pending.push({ definition, id: null, fields: deferredFields, reason: 'deferred reference' });
      }
      continue;
    }

    try {
      const data = await client.request(
        CREATE_MUTATION,
        { definition: input },
        { label: `metaobjectDefinitionCreate(${definition.type})` }
      );
      const payload = data.metaobjectDefinitionCreate;
      if (payload.userErrors?.length) {
        const detail = formatUserErrors(payload.userErrors);
        log.result('FAIL', label, '');
        log.error(`         ${detail}`);
        results.push({ kind: 'metaobject', label: definition.type, status: 'failed', detail });
        continue;
      }
      const created = payload.metaobjectDefinition;
      typeToGid.set(definition.type, created.id);
      log.result('CREATE', label, `${createFields.length} fields · ${created.id.split('/').pop()}`);
      results.push({ kind: 'metaobject', label: definition.type, status: 'created' });
      if (deferredFields.length) {
        pending.push({ definition, id: created.id, fields: deferredFields, reason: 'deferred reference' });
      }
    } catch (error) {
      const rejected = findRejectedInputKey(error.message);
      if (rejected) {
        // API version does not accept this input key — drop it and retry once.
        log.warn(`"${rejected}" not accepted on API ${client.apiVersion}; retrying without it`);
        delete input[rejected];
        try {
          const data = await client.request(
            CREATE_MUTATION,
            { definition: input },
            { label: `metaobjectDefinitionCreate(${definition.type})` }
          );
          const payload = data.metaobjectDefinitionCreate;
          if (payload.userErrors?.length) throw new Error(formatUserErrors(payload.userErrors));
          typeToGid.set(definition.type, payload.metaobjectDefinition.id);
          log.result('CREATE', label, `${createFields.length} fields (without ${rejected})`);
          results.push({ kind: 'metaobject', label: definition.type, status: 'created' });
          if (deferredFields.length) {
            pending.push({
              definition,
              id: payload.metaobjectDefinition.id,
              fields: deferredFields,
              reason: 'deferred reference',
            });
          }
          continue;
        } catch (retryError) {
          log.result('FAIL', label, retryError.message);
          results.push({
            kind: 'metaobject',
            label: definition.type,
            status: 'failed',
            detail: retryError.message,
          });
          continue;
        }
      }
      log.result('FAIL', label, error.message);
      results.push({ kind: 'metaobject', label: definition.type, status: 'failed', detail: error.message });
    }
  }

  /* ---------------- Capability reconciliation ---------------- */
  if (capabilityPatches.length) {
    log.blank();
    log.group('capabilities');
  }

  for (const item of capabilityPatches) {
    const label = c.bold(item.definition.type);
    const names = Object.keys(item.capabilities).join(', ');
    const handle = item.capabilities.onlineStore?.data?.urlHandle;
    const detail = handle ? `${names} → /pages/${handle}/…` : names;

    if (dryRun) {
      log.result('PLAN', label, `enable ${detail}`);
      results.push({ kind: 'metaobject', label: `${item.definition.type} (capabilities)`, status: 'planned' });
      continue;
    }

    try {
      const data = await client.request(
        UPDATE_MUTATION,
        { id: item.id, definition: { capabilities: item.capabilities } },
        { label: `metaobjectDefinitionUpdate(${item.definition.type} capabilities)` }
      );
      const payload = data.metaobjectDefinitionUpdate;
      if (payload.userErrors?.length) {
        const message = formatUserErrors(payload.userErrors);
        log.result('FAIL', label, '');
        log.error(`         ${message}`);
        results.push({
          kind: 'metaobject',
          label: `${item.definition.type} (capabilities)`,
          status: 'failed',
          detail: message,
        });
        continue;
      }
      log.result('PATCH', label, `enabled ${detail}`);
      results.push({ kind: 'metaobject', label: `${item.definition.type} (capabilities)`, status: 'patched' });
    } catch (error) {
      log.result('FAIL', label, error.message);
      results.push({
        kind: 'metaobject',
        label: `${item.definition.type} (capabilities)`,
        status: 'failed',
        detail: error.message,
      });
    }
  }

  /* ---------------- Pass 2: deferred / missing fields ---------------- */
  if (pending.length) {
    log.blank();
    log.group('second pass — deferred and missing fields');
  }

  for (const item of pending) {
    const label = `${c.bold(item.definition.type)}`;
    const operations = [];
    const stillUnresolved = [];

    for (const field of item.fields) {
      const { input, unresolved } = buildFieldInput(field, typeToGid);
      if (unresolved.length) {
        stillUnresolved.push(`${field.key} -> ${unresolved.join(', ')}`);
        continue;
      }
      operations.push({ create: input });
    }

    if (stillUnresolved.length) {
      const detail = `unresolved reference(s): ${stillUnresolved.join('; ')}`;
      log.result('FAIL', label, detail);
      results.push({ kind: 'metaobject', label: `${item.definition.type} (fields)`, status: 'failed', detail });
      continue;
    }
    if (!operations.length) continue;

    const keys = operations.map((o) => o.create.key).join(', ');

    if (dryRun) {
      log.result('PLAN', label, `add field(s) ${keys} — ${item.reason}`);
      results.push({ kind: 'metaobject', label: `${item.definition.type} (fields)`, status: 'planned' });
      continue;
    }

    try {
      const data = await client.request(
        UPDATE_MUTATION,
        { id: item.id, definition: { fieldDefinitions: operations } },
        { label: `metaobjectDefinitionUpdate(${item.definition.type})` }
      );
      const payload = data.metaobjectDefinitionUpdate;
      if (payload.userErrors?.length) {
        const detail = formatUserErrors(payload.userErrors);
        log.result('FAIL', label, '');
        log.error(`         ${detail}`);
        results.push({ kind: 'metaobject', label: `${item.definition.type} (fields)`, status: 'failed', detail });
        continue;
      }
      log.result('PATCH', label, `added ${keys}`);
      results.push({ kind: 'metaobject', label: `${item.definition.type} (fields)`, status: 'patched' });
    } catch (error) {
      log.result('FAIL', label, error.message);
      results.push({
        kind: 'metaobject',
        label: `${item.definition.type} (fields)`,
        status: 'failed',
        detail: error.message,
      });
    }
  }

  return { results, typeToGid };
}

/** `--only` accepts `metaobjects`, `all`, or a specific metaobject type. */
function matchesOnly(definition, only) {
  if (!only || !only.length) return true;
  return only.some(
    (token) => token === 'all' || token === 'metaobjects' || token === definition.type
  );
}
