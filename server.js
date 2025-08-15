// ✅ Fichier corrigé : server.js (en-tête + connexion uniquement)

import express from 'express';
import mysql from 'mysql';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const {
  MYSQLHOST = 'mysql.railway.internal',
  MYSQLPORT = '3306',
  MYSQLUSER = 'root',
  MYSQLPASSWORD = 'CtZtZYihlpinhqeykJbZWIhNFvQZyYIw',
  MYSQLDATABASE = 'railway',
  MYSQL_SSL = 'false',         // "false", "true" ou "required"
  CORS_ORIGIN = '*',           // ex: "http://localhost:5173,https://monfront.app"
} = process.env;

const app = express();

// CORS (autorise le front). Si CORS_ORIGIN="*", on autorise tout.
// Sinon, liste séparée par virgules.
app.use(
  cors({
    origin:
      CORS_ORIGIN === '*'
        ? true
        : CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true
  })
);

app.use(express.json());

// Option SSL si hébergeur MySQL l’exige (Railway/PlanetScale/etc.)
const sslOption =
  String(MYSQL_SSL).toLowerCase() === 'true' ||
  String(MYSQL_SSL).toLowerCase() === 'required'
    ? { rejectUnauthorized: false }
    : undefined;

// ✅ Connexion MySQL (lit les valeurs depuis .env)
export const db = mysql.createConnection({
  host: MYSQLHOST,
  port: Number(MYSQLPORT),
  user: MYSQLUSER,
  password: MYSQLPASSWORD,
  database: MYSQLDATABASE,
  ...(sslOption ? { ssl: sslOption } : {})
});

db.connect((err) => {
  if (err) {
    console.error('❌ Erreur de connexion à MySQL :', err.message);
  } else {
    console.log(
      `✅ Connecté MySQL @ ${MYSQLHOST}:${MYSQLPORT} / DB=${MYSQLDATABASE} (SSL=${sslOption ? 'on' : 'off'})`
    );
  }
});

// Petit endpoint santé (optionnel)
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});


// ------------------ UTILISATEURS ------------------ //
app.get('/utilisateurs', (req, res) => {
  db.query('SELECT * FROM utilisateurs', (err, result) => {
    if (err) return res.status(500).json({ message: 'Erreur de récupération' });
    res.json(result);
  });
});

app.post('/utilisateurs', (req, res) => {
  const {
    prenom, nom, matricule, type,
    departement, promotion = '',
    statut = 'actif', email, mot_de_passe
  } = req.body;
  const sql = `INSERT INTO utilisateurs 
    (prenom, nom, matricule, type, departement, promotion, statut, email, mot_de_passe) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [prenom, nom, matricule, type, departement, promotion, statut, email, mot_de_passe];
  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    res.json({ message: 'Utilisateur ajouté', id: result.insertId });
  });
});

app.put('/utilisateurs/:id', (req, res) => {
  const { id } = req.params;
  const {
    prenom, nom, matricule, type,
    departement, promotion = '',
    statut, email, mot_de_passe
  } = req.body;
  const sql = `UPDATE utilisateurs SET 
    prenom = ?, nom = ?, matricule = ?, type = ?, departement = ?, 
    promotion = ?, statut = ?, email = ?, mot_de_passe = ? 
    WHERE id = ?`;
  const values = [prenom, nom, matricule, type, departement, promotion, statut, email, mot_de_passe, id];
  db.query(sql, values, (err) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    res.json({ message: 'Utilisateur mis à jour' });
  });
});

app.delete('/utilisateurs/:id', (req, res) => {
  db.query('DELETE FROM utilisateurs WHERE id = ?', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    res.json({ message: 'Utilisateur supprimé' });
  });
});

// ------------------ CONNEXION ------------------ //
app.post('/api/connexion', (req, res) => {
  const { type, nom, mot_de_passe } = req.body;
  const sql = `SELECT * FROM utilisateurs WHERE nom = ? AND mot_de_passe = ? AND type = ? AND statut = 'actif'`;
  db.query(sql, [nom, mot_de_passe, type], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
    if (results.length > 0) res.status(200).json({ success: true, utilisateur: results[0] });
    else res.status(401).json({ success: false, message: 'Identifiants incorrects ou compte inactif' });
  });
});

// ------------------ HORAIRES ------------------ //
app.post('/horaires/publies', (req, res) => {
  const horaires = req.body;

  if (!Array.isArray(horaires)) {
    return res.status(400).json({ error: 'Format invalide : tableau requis' });
  }

  const sql = `
    INSERT INTO horaires_publies 
    (jour, heure_debut, heure_fin, cours, enseignant, promotion, option_filiere, salle, type_cours)
    VALUES ?
  `;

  const values = horaires.map(h => [
    h.jour.charAt(0).toUpperCase() + h.jour.slice(1).toLowerCase().trim(),
    h.heure_debut,
    h.heure_fin,
    h.cours,
    h.enseignant,
    h.promotion,
    h.option_filiere,
    h.salle,
    h.type_cours || ''
  ]);

  db.query(sql, [values], (err, result) => {
    if (err) {
      console.error('Erreur publication horaires :', err);
      return res.status(500).json({ error: 'Erreur serveur lors de la publication' });
    }
    res.status(200).json({ message: 'Horaires publiés avec succès', result });
  });
});

app.get('/horaires/publies', (req, res) => {
  const { filiere, promotion } = req.query;

  const sql = `SELECT * FROM horaires_publies WHERE option_filiere = ? AND promotion = ?`;

  db.query(sql, [filiere, promotion], (err, result) => {
    if (err) {
      console.error('Erreur récupération horaires publiés :', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(result);
  });
});

app.post('/horaires', (req, res) => {
  const horaires = req.body;
  if (!Array.isArray(horaires) || horaires.length === 0) return res.status(400).json({ message: 'Liste vide' });
  const sql = `INSERT INTO horaires  (jour, heure_debut, heure_fin, cours, enseignant, promotion, option_filiere, departement, salle, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = horaires.map(h => [h.jour, h.heure_debut, h.heure_fin, h.cours, h.enseignant, h.promotion, h.option_filiere, 'transmis', new Date()]);
  db.query(sql, [values], (err, result) => {
    if (err) return res.status(500).json({ message: 'Erreur serveur' });
    res.json({ message: 'Horaires enregistrés', inserted: result.affectedRows });
  });
});

// ------------------ HORAIRES TRANSMIS ------------------ //
app.get('/horaires_publies', (req, res) => {
  const { filiere, promotion, enseignant } = req.query;

  let sql = 'SELECT * FROM horaires_publies';
  const params = [];
  const where = []; // tableau pour accumuler les conditions

  // Filtrage par enseignant si fourni
  if (enseignant) {
    where.push('LOWER(TRIM(enseignant)) = LOWER(TRIM(?))');
    params.push(enseignant);
  }

  // Filtrage par filière et/ou promotion
  if (filiere) {
    where.push('option_filiere = ?');
    params.push(filiere);
  }
  if (promotion) {
    where.push('promotion = ?');
    params.push(promotion);
  }

  // Si on a des filtres, on les ajoute à la requête
  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ` ORDER BY FIELD(jour, 'Lundi','Mardi','Mercredi','Jeudi','Vendredi'), heure_debut`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des horaires publiés :', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json(results);
  });
});

app.get('/horaires/transmis', (req, res) => {
  const sql = 'SELECT * FROM horaires_transmis';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erreur récupération horaires transmis :', err);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.status(200).json(results);
  });
});


app.post('/horaires/transmettre', (req, res) => {
  const horaires = req.body;

  if (!Array.isArray(horaires) || horaires.length === 0) {
    return res.status(400).json({ message: 'Aucun horaire à transmettre.' });
  }

  const values = horaires.map(h => [
    h.jour,
    h.heure_debut,
    h.heure_fin,
    h.cours,
    h.enseignant,
    h.promotion,
    h.option_filiere,
    h.departement || '',
    'transmis',
    new Date()
  ]);

  const sql = `
    INSERT INTO horaires_transmis 
    (jour, heure_debut, heure_fin, cours, enseignant, promotion, option_filiere, departement, statut, transmis_at)
    VALUES ?
  `;

  db.query(sql, [values], (err, result) => {
    if (err) {
      console.error('Erreur lors de la transmission des horaires :', err);
      return res.status(500).json({ message: 'Erreur serveur.' });
    }

    res.status(201).json({ message: 'Horaires transmis.', inserted: result.affectedRows });
  });
});

// ✅ Publier un horaire (depuis horaires_transmis -> vers horaires_publies)
app.post('/horaires/publier/:id', (req, res) => {
  const horaireId = req.params.id;
  const { salle } = req.body;

  if (!salle || !salle.toString().trim()) {
    return res.status(400).json({ message: 'Salle requise' });
  }

  const selectSql = 'SELECT * FROM horaires_transmis WHERE id = ?';
  db.query(selectSql, [horaireId], (err, results) => {
    if (err) {
      console.error('[publier] Erreur SELECT:', err);
      return res.status(500).json({ message: 'Erreur serveur (select)' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Horaire non trouvé' });
    }

    const h = results[0];

    // ⚠️ Assure-toi que ces colonnes existent bien dans la table horaires_publies
    const insertSql = `
      INSERT INTO horaires_publies 
      (jour, heure_debut, heure_fin, cours, enseignant, promotion, option_filiere, salle, type_cours) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const insertValues = [
      h.jour,
      h.heure_debut,
      h.heure_fin,
      h.cours,
      h.enseignant,
      h.promotion,
      h.option_filiere,
      salle,
      h.type_cours || null
    ];

    db.query(insertSql, insertValues, (insertErr, insertResult) => {
      if (insertErr) {
        console.error('[publier] Erreur INSERT:', insertErr);
        return res.status(500).json({ message: 'Erreur lors de la publication (insert)' });
      }

      const deleteSql = 'DELETE FROM horaires_transmis WHERE id = ?';
      db.query(deleteSql, [horaireId], (deleteErr) => {
        if (deleteErr) {
          console.error('[publier] Erreur DELETE:', deleteErr);
          return res.status(500).json({ message: 'Erreur lors du nettoyage' });
        }

        // Renvoie la ligne publiée (pratique pour le front)
        const selectInserted = 'SELECT * FROM horaires_publies WHERE id = ?';
        db.query(selectInserted, [insertResult.insertId], (sErr, sRows) => {
          if (sErr) {
            console.error('[publier] Erreur SELECT inserted:', sErr);
            return res.status(200).json({ message: 'Horaire publié avec succès !' });
          }
          return res.status(200).json({
            message: 'Horaire publié avec succès !',
            published: sRows[0] || null
          });
        });
      });
    });
  });
});


// ------------------ PROMOTIONS ------------------ //

// ✅ Récupérer toutes les promotions
app.get('/promotions', (req, res) => {
  db.query("SELECT * FROM promotions", (err, result) => {
    if (err) {
      console.error('❌ Erreur récupération promotions :', err.message);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json(result);
  });
});

// ✅ Ajouter une nouvelle promotion
app.post('/promotions', (req, res) => {
  const { nom, filiere, annee_academique, nombre_etudiants } = req.body;

  if (!nom || !filiere || !annee_academique) {
    return res.status(400).json({ message: "Champs nom, filière et année académique requis." });
  }

  const sql = `
    INSERT INTO promotions 
    (nom, filiere, annee_academique, nombre_etudiants) 
    VALUES (?, ?, ?, ?)
  `;
  const values = [
    nom,
    filiere,
    annee_academique,
    nombre_etudiants || 0 // valeur par défaut si non fourni
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ Erreur ajout promotion :", err.message);
      return res.status(500).json({ message: "Erreur lors de l'ajout de la promotion." });
    }
    res.status(201).json({ message: "Promotion ajoutée avec succès", id: result.insertId });
  });
});
// ------------------ DÉPARTEMENTS ------------------ //

// 🔹 Récupérer tous les départements
app.get('/departements', (req, res) => {
  db.query("SELECT * FROM departements", (err, result) => {
    if (err) {
      console.error('❌ Erreur récupération départements :', err.message);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json(result);
  });
});

// 🔹 Ajouter un département
app.post('/departements', (req, res) => {
  const { name, code, head } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: "Champs nom et code requis." });
  }

  const sql = "INSERT INTO departements (name, code, head) VALUES (?, ?, ?)";
  const values = [name, code, head || ''];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("❌ Erreur ajout département :", err.message);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json({ message: 'Département ajouté', id: result.insertId });
  });
});

// 🔹 Supprimer un département
app.delete('/departements/:id', (req, res) => {
  db.query("DELETE FROM departements WHERE id = ?", [req.params.id], (err, result) => {
    if (err) {
      console.error("❌ Erreur suppression département :", err.message);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json({ message: 'Département supprimé' });
  });
});
// ------------------ SALLES ------------------ //

// 🔹 Récupérer toutes les salles
app.get('/salles', (req, res) => {
  db.query("SELECT * FROM salles", (err, result) => {
    if (err) {
      console.error("❌ Erreur récupération salles :", err.message);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json(result);
  });
});

// 🔹 Ajouter une salle
app.post('/salles', (req, res) => {
  const { nom, capacite, type } = req.body;

  if (!nom || !capacite || !type) {
    return res.status(400).json({ message: "Champs nom, capacité et type requis." });
  }

  const sql = "INSERT INTO salles (nom, capacite, type) VALUES (?, ?, ?)";
  db.query(sql, [nom, capacite, type], (err, result) => {
    if (err) {
      console.error("❌ Erreur ajout salle :", err.message);
      return res.status(500).json({ message: "Erreur lors de l'ajout de la salle." });
    }
    res.status(201).json({ message: "Salle ajoutée avec succès", id: result.insertId });
  });
});

// 🔹 Supprimer une salle
app.delete('/salles/:id', (req, res) => {
  db.query("DELETE FROM salles WHERE id = ?", [req.params.id], (err, result) => {
    if (err) {
      console.error("❌ Erreur suppression salle :", err.message);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
    res.json({ message: 'Salle supprimée' });
  });
});
// ------------------ SERVEUR ------------------ //
const PORT = process.env.PORT || 3001;

app.listen(Number(PORT), () => {
  console.log(`🚀 Serveur backend démarré sur http://localhost:${PORT}`);
});
