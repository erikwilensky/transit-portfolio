import maya from './maya.js';
import arun from './arun.js';
import lena from './lena.js';
import cohort from './cohort.js';
import starters from './starters.js';
import alum from './alum.js';

// Documents behind every piece of evidence, keyed by station id and then by caption.
export const DOCS = { ...maya, ...arun, ...lena, ...cohort, ...alum, '*': starters };
