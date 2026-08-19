// Dictionnaire FR (fragmentation par domaine, clé = texte chinois d’origine). Les fichiers de données sont exemptés de la limite de lignes.
// Volontairement vide : les résumés d’erreurs/modifications de src/script/* ne vont que dans les tool_result de l’agent (côté LLM),
// et selon la convention de locale.ts, l’interface LLM n’entre pas dans l’i18n (voir la consommation dans script-tools.ts).
export default {} as Record<string, string>;
