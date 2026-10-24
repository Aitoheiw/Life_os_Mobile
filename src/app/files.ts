/**
 * Remise d'un fichier généré par l'app (sauvegarde, événement de calendrier…) à l'utilisateur.
 * Tout se passe dans le navigateur : aucun envoi vers un serveur.
 */

/** Déclenche le téléchargement (ou l'ouverture, sur iPhone) d'un fichier. */
export function downloadFile(file: Blob, fileName: string): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Libération différée : Safari iOS lit parfois l'URL après le clic.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Vrai si le navigateur sait partager ce fichier via le menu de partage du système (iPhone, Android, Windows). */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/**
 * Ouvre le menu de partage du système avec ce fichier.
 * Retourne false si l'utilisateur a fermé le menu sans choisir (ce n'est pas une erreur).
 */
export async function shareFile(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false;
    throw err;
  }
}
