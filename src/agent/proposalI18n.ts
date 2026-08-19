// Traduction au rendu des textes de proposition assemblés côté données.
// proposal.ts construit labels et résumés en chinois (la chaîne zh sert de clé i18n) ;
// ce helper traduit chaque segment au moment de l'affichage, avec repli sur le texte brut.
import { t } from '../i18n/locale';

const SEGMENT_UNIT = /^([+−-]?\d+)\s*(序列|片段|处改动)$/;

/** Traduit un segment simple : clé exacte du dictionnaire, sinon motif « ±N unité », sinon texte brut. */
export function translateProposalSegment(segment: string): string {
  const unit = segment.match(SEGMENT_UNIT);
  if (unit) return `${unit[1]} ${t(unit[2]!)}`;
  return t(segment);
}

/** Traduit un texte assemblé par « · » (résumés, impacts) segment par segment. */
export function translateProposalText(text: string): string {
  if (!text) return text;
  return text.split(' · ').map(translateProposalSegment).join(' · ');
}
