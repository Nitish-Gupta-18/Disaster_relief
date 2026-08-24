import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'disaster_relief.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -8000');
db.pragma('mmap_size = 268435456');

const now = () => new Date().toISOString();

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('food', 'water', 'medicine', 'shelter')),
      urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
      family_size INTEGER NOT NULL CHECK (family_size > 0),
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      skills TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_name TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    -- Add email column to existing volunteers table if missing (safe migration)
    -- SQLite does not support IF NOT EXISTS for ALTER TABLE, so we catch the error in JS below
  `);

  // Safe migration: add email column if it doesn't exist
  try {
    db.exec(`ALTER TABLE volunteers ADD COLUMN email TEXT`);
  } catch (e) {
    // Column already exists — safe to ignore
    if (!e.message.includes('duplicate column name')) console.error('Migration note:', e.message);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('food', 'medicine', 'equipment', 'shelter', 'clothing', 'other')),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      unit TEXT NOT NULL,
      location_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_name TEXT NOT NULL,
      donor_email TEXT,
      donor_phone TEXT,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('food', 'medicine', 'equipment', 'shelter', 'clothing', 'other')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit TEXT NOT NULL,
      drop_location TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'distributed')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_name TEXT NOT NULL,
      donor_email TEXT,
      donor_phone TEXT,
      amount REAL NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_method TEXT,
      transaction_id TEXT,
      purpose TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      volunteer_id INTEGER NOT NULL,
      assigned_at TEXT NOT NULL,
      UNIQUE (request_id, volunteer_id),
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resource_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      assigned_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS relief_camps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      volunteer_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'in_progress', 'completed', 'rejected')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      admin_notes TEXT DEFAULT '',
      volunteer_notes TEXT DEFAULT '',
      due_date TEXT,
      assigned_by TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
    );

    -- Migrate existing request_volunteers into assignments if needed
    INSERT OR IGNORE INTO assignments (request_id, volunteer_id, status, priority, assigned_by, created_at, updated_at)
    SELECT rv.request_id, rv.volunteer_id, 'assigned', 'medium', 'system', rv.assigned_at, rv.assigned_at
    FROM request_volunteers rv
    WHERE NOT EXISTS (SELECT 1 FROM assignments a WHERE a.request_id = rv.request_id AND a.volunteer_id = rv.volunteer_id);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('admin', 'volunteer', 'user')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.prepare('CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_requests_urgency ON requests(urgency)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_volunteers_available ON volunteers(is_available)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_donations_category ON donations(category)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_financial_donations_status ON financial_donations(status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_assignments_request ON assignments(request_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_assignments_volunteer ON assignments(volunteer_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)').run();
}

function tableIsEmpty(tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count === 0;
}

function seedRequests() {
  if (!tableIsEmpty('requests')) return;

  const records = [
    { location: 'Silchar, Cachar', latitude: 24.8333, longitude: 92.7789, type: 'water', urgency: 'critical', family_size: 18, description: 'Tube wells submerged; urgent drinking water required near riverbank settlement.', status: 'pending' },
    { location: 'Barpeta Road, Barpeta', latitude: 26.5028, longitude: 90.9694, type: 'food', urgency: 'high', family_size: 32, description: 'Dry ration needed for families sheltering at the school building.', status: 'assigned' },
    { location: 'Majuli Island', latitude: 26.9500, longitude: 94.2167, type: 'medicine', urgency: 'medium', family_size: 11, description: 'Fever, skin infection and ORS supply needed after prolonged flooding.', status: 'in_progress' },
    { location: 'Dibrugarh', latitude: 27.4728, longitude: 94.9120, type: 'shelter', urgency: 'high', family_size: 24, description: 'Temporary tarpaulin shelter required for displaced riverside households.', status: 'pending' },
    { location: 'Morigaon', latitude: 26.2529, longitude: 92.3426, type: 'food', urgency: 'low', family_size: 8, description: 'Supplementary food packets requested for elderly residents.', status: 'completed' },
    { location: 'Patna City', latitude: 25.5941, longitude: 85.1376, type: 'medicine', urgency: 'critical', family_size: 15, description: 'First aid and essential medicines required after evacuation.', status: 'assigned' },
    { location: 'Darbhanga', latitude: 26.1542, longitude: 85.8918, type: 'shelter', urgency: 'medium', family_size: 27, description: 'Families moved from low-lying ward need tent support.', status: 'in_progress' },
    { location: 'Muzaffarpur', latitude: 26.1209, longitude: 85.3647, type: 'water', urgency: 'high', family_size: 20, description: 'Water purification tablets needed after hand pumps were contaminated.', status: 'pending' }
  ];

  const insert = db.prepare('INSERT INTO requests (location, latitude, longitude, type, urgency, family_size, description, status, created_at, updated_at) VALUES (@location, @latitude, @longitude, @type, @urgency, @family_size, @description, @status, @created_at, @updated_at)');

  const seedTime = now();
  const seed = db.transaction(() => {
    records.forEach((record, index) => {
      insert.run({
        ...record,
        created_at: new Date(Date.now() - (index + 1) * 1000 * 60 * 60 * 5).toISOString(),
        updated_at: record.status === 'completed' ? seedTime : new Date(Date.now() - index * 1000 * 60 * 60).toISOString()
      });
    });
  });
  seed();
}

function seedVolunteers() {
  if (!tableIsEmpty('volunteers')) return;

  const records = [
    { name: 'Ananya Das', phone: '+91 98765 11001', email: 'ananya.das@example.com', skills: ['medical', 'logistics'], latitude: 26.1445, longitude: 91.7362, location_name: 'Guwahati', is_available: 1 },
    { name: 'Ravi Kumar', phone: '+91 98765 11002', email: 'ravi.kumar@example.com', skills: ['rescue', 'transport'], latitude: 25.5941, longitude: 85.1376, location_name: 'Patna', is_available: 0 },
    { name: 'Meera Singh', phone: '+91 98765 11003', email: 'meera.singh@example.com', skills: ['medical'], latitude: 26.1542, longitude: 85.8918, location_name: 'Darbhanga', is_available: 1 },
    { name: 'Pranab Bora', phone: '+91 98765 11004', email: 'pranab.bora@example.com', skills: ['rescue', 'logistics'], latitude: 26.5028, longitude: 90.9694, location_name: 'Barpeta', is_available: 1 },
    { name: 'Farhan Ali', phone: '+91 98765 11005', email: 'farhan.ali@example.com', skills: ['transport', 'logistics'], latitude: 24.8333, longitude: 92.7789, location_name: 'Silchar', is_available: 0 },
    { name: 'Neha Verma', phone: '+91 98765 11006', email: 'neha.verma@example.com', skills: ['rescue', 'medical'], latitude: 26.1209, longitude: 85.3647, location_name: 'Muzaffarpur', is_available: 1 }
  ];

  const insert = db.prepare('INSERT INTO volunteers (name, phone, email, skills, latitude, longitude, location_name, is_available, created_at) VALUES (@name, @phone, @email, @skills, @latitude, @longitude, @location_name, @is_available, @created_at)');
  const seed = db.transaction(() => {
    records.forEach((r) => insert.run({ ...r, skills: JSON.stringify(r.skills), created_at: now() }));
  });
  seed();
}

function seedInventory() {
  if (!tableIsEmpty('inventory')) return;

  const records = [
    ['Food packets', 'food', 450, 'packets', 'Guwahati Relief Warehouse', 26.1445, 91.7362],
    ['Medicines', 'medicine', 120, 'boxes', 'Patna Medical Depot', 25.5941, 85.1376],
    ['Blankets', 'shelter', 80, 'pieces', 'Darbhanga Camp Store', 26.1542, 85.8918],
    ['Tents', 'shelter', 15, 'sets', 'Cachar District Store', 24.8333, 92.7789],
    ['Rescue boats', 'equipment', 3, 'boats', 'Barpeta Boat Point', 26.5028, 90.9694],
    ['ORS packets', 'medicine', 600, 'packets', 'Guwahati Relief Warehouse', 26.1445, 91.7362],
    ['First aid kits', 'medicine', 40, 'kits', 'Patna Medical Depot', 25.5941, 85.1376],
    ['Water purification tablets', 'medicine', 200, 'strips', 'Muzaffarpur Block Store', 26.1209, 85.3647],
    ['Torches', 'equipment', 55, 'pieces', 'Dibrugarh Field Store', 27.4728, 94.9120],
    ['Ropes', 'equipment', 25, 'bundles', 'Barpeta Boat Point', 26.5028, 90.9694]
  ];

  const insert = db.prepare('INSERT INTO inventory (item_name, category, quantity, unit, location_name, latitude, longitude, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const seed = db.transaction(() => { records.forEach((r) => insert.run(...r, now())); });
  seed();
}

function seedCamps() {
  if (!tableIsEmpty('relief_camps')) return;

  const records = [
    ['Cachar School Relief Camp', 'Silchar, Cachar', 24.8274, 92.7979, 260],
    ['Kankarbagh Transit Camp', 'Patna', 25.6026, 85.1583, 180]
  ];

  const insert = db.prepare('INSERT INTO relief_camps (name, location_name, latitude, longitude, capacity, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const seed = db.transaction(() => { records.forEach((r) => insert.run(...r, now())); });
  seed();
}

function seedDonations() {
  if (!tableIsEmpty('donations')) return;

  const records = [
    { donor_name: 'Rajesh Sharma', donor_email: 'rajesh@email.com', donor_phone: '+91 98101 23456', item_name: 'Rice bags', category: 'food', quantity: 50, unit: 'kg', drop_location: 'Guwahati Relief Warehouse', status: 'received', notes: 'Donated by local grocery association', created_at: new Date(Date.now() - 6 * 3600000).toISOString() },
    { donor_name: 'Priya Patel', donor_email: 'priya@email.com', donor_phone: '+91 98202 34567', item_name: 'Blankets', category: 'shelter', quantity: 30, unit: 'pieces', drop_location: 'Patna Collection Center', status: 'received', notes: 'Winter blankets for displaced families', created_at: new Date(Date.now() - 12 * 3600000).toISOString() },
    { donor_name: 'Amit Verma', donor_email: 'amit@email.com', donor_phone: '+91 98303 45678', item_name: 'First Aid Kits', category: 'medicine', quantity: 20, unit: 'kits', drop_location: 'Darbhanga Camp Store', status: 'pending', notes: 'Basic first aid supplies', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
    { donor_name: 'Sunita Devi', donor_email: 'sunita@email.com', donor_phone: '+91 98404 56789', item_name: 'Used Clothes', category: 'clothing', quantity: 100, unit: 'pieces', drop_location: 'Silchar Community Hall', status: 'received', notes: 'Gently used clothes for all ages', created_at: new Date(Date.now() - 18 * 3600000).toISOString() },
    { donor_name: 'Vikram Singh', donor_email: 'vikram@email.com', donor_phone: '+91 98505 67890', item_name: 'Torches & Batteries', category: 'equipment', quantity: 40, unit: 'sets', drop_location: 'Muzaffarpur Block Store', status: 'distributed', notes: 'Essential for night rescue operations', created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
    { donor_name: 'Meena Kumari', donor_email: 'meena@email.com', donor_phone: '+91 98606 78901', item_name: 'Baby Food', category: 'food', quantity: 25, unit: 'packets', drop_location: 'Guwahati Relief Warehouse', status: 'pending', notes: 'Infant formula and baby cereal', created_at: new Date(Date.now() - 1 * 3600000).toISOString() }
  ];

  const insert = db.prepare('INSERT INTO donations (donor_name, donor_email, donor_phone, item_name, category, quantity, unit, drop_location, status, notes, created_at, updated_at) VALUES (@donor_name, @donor_email, @donor_phone, @item_name, @category, @quantity, @unit, @drop_location, @status, @notes, @created_at, @created_at)');
  const seed = db.transaction(() => { records.forEach((r) => insert.run(r)); });
  seed();
}

function seedFinancialDonations() {
  if (!tableIsEmpty('financial_donations')) return;

  const records = [
    { donor_name: 'Anand Gupta', donor_email: 'anand@email.com', donor_phone: '+91 98701 11111', amount: 25000, currency: 'INR', payment_method: 'upi', transaction_id: 'UPI123456789', purpose: 'Food supplies for Silchar', status: 'completed', notes: '', created_at: new Date(Date.now() - 4 * 3600000).toISOString() },
    { donor_name: 'Kavita Reddy', donor_email: 'kavita@email.com', donor_phone: '+91 98702 22222', amount: 50000, currency: 'INR', payment_method: 'bank_transfer', transaction_id: 'NEFT987654321', purpose: 'Medical aid for Patna camps', status: 'completed', notes: 'Corporate CSR donation', created_at: new Date(Date.now() - 8 * 3600000).toISOString() },
    { donor_name: 'Rohit Malhotra', donor_email: 'rohit@email.com', donor_phone: '+91 98703 33333', amount: 10000, currency: 'INR', payment_method: 'card', transaction_id: 'CC555666777', purpose: 'General relief fund', status: 'pending', notes: '', created_at: new Date(Date.now() - 1 * 3600000).toISOString() },
    { donor_name: 'Lakshmi Nair', donor_email: 'lakshmi@email.com', donor_phone: '+91 98704 44444', amount: 15000, currency: 'INR', payment_method: 'upi', transaction_id: 'UPI888999000', purpose: 'Shelter materials for Darbhanga', status: 'completed', notes: 'Donation from community fundraiser', created_at: new Date(Date.now() - 15 * 3600000).toISOString() }
  ];

  const insert = db.prepare('INSERT INTO financial_donations (donor_name, donor_email, donor_phone, amount, currency, payment_method, transaction_id, purpose, status, notes, created_at, updated_at) VALUES (@donor_name, @donor_email, @donor_phone, @amount, @currency, @payment_method, @transaction_id, @purpose, @status, @notes, @created_at, @created_at)');
  const seed = db.transaction(() => { records.forEach((r) => insert.run(r)); });
  seed();
}

function seedUsers() {
  if (!tableIsEmpty('users')) return;

  const ts = now();
  const adminHash = bcrypt.hashSync('admin123', 10);
  const volunteerHash = bcrypt.hashSync('volunteer123', 10);

  const insert = db.prepare('INSERT INTO users (email, name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)');
  const seed = db.transaction(() => {
    insert.run('admin@relief.org', 'Admin User', adminHash, 'admin', ts, ts);
    insert.run('volunteer@relief.org', 'Rajesh Volunteer', volunteerHash, 'volunteer', ts, ts);
    insert.run('ananya.das@relief.org', 'Ananya Das', volunteerHash, 'volunteer', ts, ts);
  });
  seed();
}

export function initDb() {
  createSchema();
  // Seed functions are available below but NOT called by default.
  // Uncomment to populate with sample data:
  // seedRequests(); seedVolunteers(); seedInventory(); seedCamps(); seedDonations(); seedFinancialDonations();
}

// Always run schema creation — CREATE IF NOT EXISTS is safe to run every time.
// This ensures new tables (like users, sessions) are created even on existing databases.
initDb();

export default db;
