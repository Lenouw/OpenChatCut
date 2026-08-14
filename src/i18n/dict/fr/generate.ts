// Dictionnaire FR (fragmentation par domaine, clé = texte chinois d’origine). Les fichiers de données sont exemptés de la limite de lignes.
// Volontairement vide : les erreurs levées par src/generate/* sont toutes rédigées en anglais dans le code,
// et ce mécanisme ne gère que clé chinoise→traduction (pas d’inverse en→zh), donc aucune entrée à enregistrer.
export default {} as Record<string, string>;
