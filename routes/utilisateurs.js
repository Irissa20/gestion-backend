const express = require('express');
const router = express.Router();
const db = require('../db');

// 📌 GET tous les utilisateurs
router.get('/', (req, res) => {
  db.query('SELECT * FROM utilisateurs', (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des utilisateurs :', err);
      res.status(500).json({ error: 'Erreur serveur' });
    } else {
      res.json(results);
    }
  });
});

// 🔐 Connexion utilisateur (simple)
router.post('/login', (req, res) => {
  const { email, mot_de_passe } = req.body;
  db.query(
    'SELECT * FROM utilisateurs WHERE email = ? AND mot_de_passe = ?',
    [email, mot_de_passe],
    (err, results) => {
      if (err) {
        res.status(500).json({ error: 'Erreur serveur' });
      } else if (results.length > 0) {
        res.json({ success: true, user: results[0] });
      } else {
        res.status(401).json({ success: false, message: 'Identifiants incorrects' });
      }
    }
  );
});

// 🗑️ Supprimer un utilisateur par ID
router.delete('/:id', (req, res) => {
  const userId = req.params.id;

  db.query('DELETE FROM utilisateurs WHERE id = ?', [userId], (err, result) => {
    if (err) {
      console.error('Erreur lors de la suppression :', err);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    } else {
      res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
    }
  });
});

module.exports = router;
