import { hash } from 'bcryptjs';
import { pool } from './db.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  if ((await client.query("SELECT 1 FROM users WHERE email='alice@example.test'")).rowCount) {
    await client.query('ROLLBACK');
    console.log('Seed déjà chargé');
  } else {
    const house = async (name: string) => (await client.query<{id:string}>('INSERT INTO households(name) VALUES($1) RETURNING id', [name])).rows[0].id;
    const homes = [await house('Foyer Alice et Bob'), await house('Foyer Charlie'), await house('Foyer David'), await house('Foyer Éloïse')];
    const password = await hash('GiftitDemo2026!', 12);
    const user = async (first: string, last: string, home: string, birth: string, nameDay: string) =>
      (await client.query<{id:string}>(`INSERT INTO users(household_id,first_name,last_name,email,password_hash,birth_date,name_day,household_admin)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [home, first, last, `${first.toLowerCase()}@example.test`, password, birth, nameDay, true])).rows[0].id;
    const [alice, bob, charlie, david, eloise] = [
      await user('Alice', 'Martin', homes[0], '1990-10-15', '12-16'), await user('Bob', 'Martin', homes[0], '1991-04-18', '07-14'),
      await user('Charlie', 'Bernard', homes[1], '1987-06-08', '03-02'), await user('David', 'Moreau', homes[2], '1992-03-20', '12-29'),
      await user('Eloise', 'Petit', homes[3], '1995-11-30', '03-11'),
    ];
    const family = async (name: string, homeIds: string[], admin: string) => {
      const id = (await client.query<{id:string}>('INSERT INTO families(name) VALUES($1) RETURNING id', [name])).rows[0].id;
      for (const home of homeIds) await client.query('INSERT INTO memberships VALUES($1,$2)', [id, home]);
      await client.query('INSERT INTO family_admins VALUES($1,$2)', [id, admin]);
      const occasions: string[] = [];
      for (const [label, kind, month, day] of [['Anniversaire', 'birthday', null, null], ['Noël', 'fixed', 12, 25], ['Fête', 'name_day', null, null]]) {
        const row = (await client.query<{id:string}>('INSERT INTO occasions(family_id,name,kind,month,day) VALUES($1,$2,$3,$4,$5) RETURNING id',
          [id, label, kind, month, day])).rows[0];
        occasions.push(row.id);
      }
      return occasions;
    };
    const a = await family('Famille A', [homes[0], homes[1]], alice);
    const b = await family('Famille B', [homes[0], homes[2]], bob);
    await family('Famille C', [homes[3]], eloise);
    const wish = async (owner: string, title: string, description: string, price: number, tags: string[], position: number) =>
      (await client.query<{id:string}>(`INSERT INTO wishes(owner_id,title,url,image,description,price,tags,position)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [owner, title, 'https://example.com/', 'https://picsum.photos/seed/gift/400/300',
        description, price, tags, position])).rows[0].id;
    const consoleId = await wish(bob, 'Console de jeux', 'Une console récente pour jouer en famille le week-end.', 350, ['jeux', 'électronique'], 0);
    const book = await wish(bob, 'Roman illustré', 'Une belle édition illustrée à lire au coin du feu.', 29, ['livres'], 1);
    const camera = await wish(alice, 'Appareil photo', 'Un hybride compact pour les photos de voyage.', 220, ['électronique'], 0);
    await wish(charlie, 'Lampe de bureau', 'Une lampe LED orientable avec lumière chaude.', 49, ['maison'], 0);
    await wish(david, 'Jeu de société', 'Un jeu coopératif rapide pour 2 à 6 joueurs.', 39, ['jeux'], 0);
    await wish(eloise, 'Vélo', 'Un vélo de ville léger avec porte-bagages.', 500, ['sport'], 0);
    const reserve = async (wishId: string, creator: string, status: string, open: boolean, people: string[], events: [string, number][]) => {
      const id = (await client.query<{id:string}>('INSERT INTO reservations(wish_id,creator_id,status,open_to_contributions) VALUES($1,$2,$3,$4) RETURNING id',
        [wishId, creator, status, open])).rows[0].id;
      for (const participant of people) await client.query('INSERT INTO participants VALUES($1,$2)', [id, participant]);
      for (const [occasion, year] of events) await client.query('INSERT INTO reservation_occasions VALUES($1,$2,$3)', [id, occasion, year]);
      return id;
    };
    const r = await reserve(consoleId, alice, 'reserved', true, [alice, charlie], [[a[1], 2026], [a[0], 2027]]);
    await client.query('INSERT INTO requests(reservation_id,user_id) VALUES($1,$2)', [r, david]);
    await reserve(book, charlie, 'purchased', false, [charlie], [[a[0], 2027]]);
    const gifted = await reserve(camera, bob, 'gifted', false, [bob, david], [[b[1], 2025]]);
    await client.query('UPDATE wishes SET gifted_at=now() WHERE id=$1', [camera]);
    const snapshot = (await client.query('SELECT * FROM wishes WHERE id=$1', [camera])).rows[0];
    const giftReservation = (await client.query('SELECT created_at FROM reservations WHERE id=$1', [gifted])).rows[0];
    const recipient = (await client.query('SELECT id,first_name,last_name,birth_date FROM users WHERE id=$1', [alice])).rows[0];
    const people = (await client.query('SELECT id,first_name,last_name FROM users WHERE id=ANY($1::uuid[])', [[bob, david]])).rows;
    await client.query('INSERT INTO history(reservation_id,recipient_id,snapshot) VALUES($1,$2,$3)',
      [gifted, alice, JSON.stringify({ ...snapshot, recipientId: alice, creatorId: bob, recipient, creator: people.find(p => p.id === bob), participants: people,
        occasions: [{ name: 'Noël', year: 2025 }], reservedAt: giftReservation.created_at, giftedAt: snapshot.gifted_at })]);
    await client.query('COMMIT');
    console.log('Seed chargé. alice/bob/charlie/david/eloise@example.test : GiftitDemo2026!');
  }
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
