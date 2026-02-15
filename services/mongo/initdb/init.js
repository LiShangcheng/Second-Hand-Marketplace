db = db.getSiblingDB('marketplace');
db.items.insertMany([
  { name: 'Welcome', price: 0, description: 'Sample item', created_at: new Date().toISOString() },
  { name: 'Notebook', price: 5.5, description: 'Stationery', created_at: new Date().toISOString() }
]);
