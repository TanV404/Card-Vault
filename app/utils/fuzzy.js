export function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function getNameSimilarity(name1, name2) {
  const n1 = (name1 || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = (name2 || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1.0;

  const distance = getLevenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  
  return 1 - distance / maxLength;
}

export function findDuplicateContact(newCard, existingCards, threshold = 0.8) {
  if (!newCard || !existingCards || !Array.isArray(existingCards)) return null;

  const newEmail = (newCard.email || '').trim().toLowerCase();
  const newName = (newCard.person_name || '').trim();

  if (!newName) return null;

  for (const card of existingCards) {
    // 1. Check exact email match
    if (newEmail && card.email && newEmail === card.email.trim().toLowerCase()) {
      return { card, reason: 'email', match: card.email };
    }

    // 2. Check fuzzy name match
    const similarity = getNameSimilarity(newName, card.person_name);
    if (similarity >= threshold) {
      return { card, reason: 'name', match: card.person_name, similarity };
    }
  }

  return null;
}
