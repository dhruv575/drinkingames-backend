/**
 * Generates a random 4-letter lobby code
 */
function generateLobbyCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluded I and O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

/**
 * Generates a unique lobby code that doesn't exist in the current lobbies
 */
function generateUniqueLobbyCode(existingCodes) {
  let code;
  do {
    code = generateLobbyCode();
  } while (existingCodes.has(code));
  return code;
}

module.exports = {
  generateLobbyCode,
  generateUniqueLobbyCode
};
