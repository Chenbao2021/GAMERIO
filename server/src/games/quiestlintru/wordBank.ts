import { WordPair } from './types'

// Server-only. Never expose this list to the client — it would let players read every
// possible word pair from the network tab / bundle and trivially spot the intruder.
export const wordBank: WordPair[] = [
  { category: 'Animaux', majority: 'Chat', intruder: 'Tigre' },
  { category: 'Animaux', majority: 'Chien', intruder: 'Loup' },
  { category: 'Animaux', majority: 'Dauphin', intruder: 'Requin' },
  { category: 'Nourriture', majority: 'Pizza', intruder: 'Tarte' },
  { category: 'Nourriture', majority: 'Croissant', intruder: 'Brioche' },
  { category: 'Nourriture', majority: 'Chocolat', intruder: 'Caramel' },
  { category: 'Métiers', majority: 'Médecin', intruder: 'Infirmier' },
  { category: 'Métiers', majority: 'Pompier', intruder: 'Policier' },
  { category: 'Métiers', majority: 'Boulanger', intruder: 'Pâtissier' },
  { category: 'Lieux', majority: 'Plage', intruder: 'Piscine' },
  { category: 'Lieux', majority: 'Montagne', intruder: 'Colline' },
  { category: 'Lieux', majority: 'Bibliothèque', intruder: 'Librairie' },
  { category: 'Objets', majority: 'Téléphone', intruder: 'Tablette' },
  { category: 'Objets', majority: 'Stylo', intruder: 'Crayon' },
  { category: 'Objets', majority: 'Valise', intruder: 'Sac à dos' },
  { category: 'Sports', majority: 'Football', intruder: 'Rugby' },
  { category: 'Sports', majority: 'Tennis', intruder: 'Badminton' },
  { category: 'Sports', majority: 'Natation', intruder: 'Plongée' },
  { category: 'Boissons', majority: 'Café', intruder: 'Thé' },
  { category: 'Boissons', majority: "Jus d'orange", intruder: 'Limonade' },
  { category: 'Transport', majority: 'Vélo', intruder: 'Trottinette' },
  { category: 'Transport', majority: 'Train', intruder: 'Tramway' },
]
