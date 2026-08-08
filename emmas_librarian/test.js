const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'C:\\Users\\G51 Informática\\AppData\\Roaming\\emmas_librarian\\emma.db';
const db = new Database(dbPath, { readonly: true });

const projectId = 3;
const textAndBool = db
  .prepare(
    `
  SELECT ac.article_id, ac.category_id, ac.value, pc.name, pc.type
  FROM article_categories ac
  JOIN project_categories pc ON ac.category_id = pc.id
  WHERE pc.project_id = ?
`
  )
  .all(projectId);

console.log("textAndBool:", textAndBool.slice(0, 5));

const selections = db
  .prepare(
    `
  SELECT acs.article_id, acs.category_id, acs.option_id, pco.name as option_name, pc.name, pc.type
  FROM article_category_selections acs
  JOIN project_categories pc ON acs.category_id = pc.id
  JOIN project_category_options pco ON acs.option_id = pco.id
  WHERE pc.project_id = ?
`
  )
  .all(projectId);

console.log("selections:", selections.slice(0, 5));

db.close();
