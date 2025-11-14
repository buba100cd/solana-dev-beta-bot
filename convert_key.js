// convert_key.js
import bs58 from 'bs58';

// Wklej tutaj swoją tablicę klucza prywatnego z formatu JSON, którą podałeś wcześniej
const privateKeyArray = [37,128,205,93,181,93,161,164,217,206,118,234,103,77,237,193,183,31,94,246,234,54,46,15,225,76,45,226,239,204,184,70,255,73,190,242,153,221,99,171,202,95,139,204,102,123,87,139,40,117,4,153,128,49,246,223,56,57,143,29,174,80,71,80];

// Konwertuj tablicę na Buffer
const privateKeyBuffer = Buffer.from(privateKeyArray);

// Zdekoduj Buffer do formatu Base58
const privateKeyBase58 = bs58.encode(privateKeyBuffer);

console.log("===============================================");
console.log("Twój POPRAWNY klucz prywatny w formacie Base58:");
console.log("===============================================");
console.log(privateKeyBase58);
console.log("===============================================");