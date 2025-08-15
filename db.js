const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Mets ton mot de passe MySQL ici si tu en as mis un
  database: 'gestion_horaires'
});

db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données :', err);
  } else {
    console.log('Connecté à la base de données MySQL ✅');
  }
});

module.exports = db;
