// Assemblage du dictionnaire FR (source unique) : fichiers découpés par domaine, clé = texte chinois d’origine, valeur = français.
// Chaque fichier de domaine est rempli indépendamment pour éviter les conflits de fusion.
import audio from './audio';
import captions from './captions';
import chat from './chat';
import components from './components';
import editor from './editor';
import exportPanel from './exportPanel';
import fx from './fx';
import generate from './generate';
import library from './library';
import media from './media';
import progress from './progress';
import review from './review';
import script from './script';
import settings from './settings';
import timeline from './timeline';
import topbar from './topbar';
import transcript from './transcript';

export const FR: Record<string, string> = Object.assign(
  {},
  audio, captions, chat, components, editor, exportPanel, fx, generate,
  library, media, progress, review, script, settings, timeline, topbar, transcript,
);
