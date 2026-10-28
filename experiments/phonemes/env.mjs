// The experiment's defaults, set before the scorer loads (lib.mjs imports this
// first): the xlsr model, from this folder's models/ (see README, Setup).
// PHONEME_MODEL / PHONEME_MODEL_DIR still override them.
import { join } from 'node:path'

process.env.PHONEME_MODEL ??= 'xlsr'
process.env.PHONEME_MODEL_DIR ??= join(new URL('.', import.meta.url).pathname, 'models')
