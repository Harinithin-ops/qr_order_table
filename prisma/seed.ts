import { prisma } from '../src/lib/prisma';

async function main() {
  // Clean existing data
  await prisma.bill.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.branch.deleteMany();

  // Create branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Kavitha Hotel',
      address: '123 Main Road, City Center',
      phone: '+91 98765 43210',
      gstNumber: '29ABCDE1234F1Z5',
    },
  });

  // Create tables
  for (let i = 1; i <= 10; i++) {
    await prisma.table.create({
      data: {
        tableNumber: i,
        slug: `table-${i}`,
        branchId: branch.id,
        active: true,
      },
    });
  }

  // Create categories
  const idly = await prisma.menuCategory.create({ data: { name: 'Idly', displayOrder: 1 } });
  const roast = await prisma.menuCategory.create({ data: { name: 'Roast', displayOrder: 2 } });
  const ravaRoast = await prisma.menuCategory.create({ data: { name: 'Rava Roast', displayOrder: 3 } });
  const uthappam = await prisma.menuCategory.create({ data: { name: 'Uthappam', displayOrder: 4 } });
  const sevai = await prisma.menuCategory.create({ data: { name: 'Sevai', displayOrder: 5 } });
  const breakfast = await prisma.menuCategory.create({ data: { name: 'Breakfast', displayOrder: 6 } });
  const vadai = await prisma.menuCategory.create({ data: { name: 'Vadai', displayOrder: 7 } });
  const lunch = await prisma.menuCategory.create({ data: { name: 'Lunch', displayOrder: 8 } });
  const gravy = await prisma.menuCategory.create({ data: { name: 'Gravy', displayOrder: 9 } });
  const friedRice = await prisma.menuCategory.create({ data: { name: 'Fried Rice', displayOrder: 10 } });
  const noodles = await prisma.menuCategory.create({ data: { name: 'Noodles', displayOrder: 11 } });
  const dinner = await prisma.menuCategory.create({ data: { name: 'Dinner', displayOrder: 12 } });
  const parotta = await prisma.menuCategory.create({ data: { name: 'Parotta', displayOrder: 13 } });
  const indianBreads = await prisma.menuCategory.create({ data: { name: 'Indian Breads', displayOrder: 14 } });
  const starters = await prisma.menuCategory.create({ data: { name: 'Starters / Chinese', displayOrder: 15 } });
  const soup = await prisma.menuCategory.create({ data: { name: 'Soup', displayOrder: 16 } });
  const drinks = await prisma.menuCategory.create({ data: { name: 'Drinks & Desserts', displayOrder: 17 } });

  // --- IDLY ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Idly', description: 'Soft steamed rice cakes served with sambar & chutney', price: 15, categoryId: idly.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Sambar Idly', description: 'Idly soaked in hot sambar', price: 40, categoryId: idly.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Chilly Idly', description: 'Crispy idly tossed with chilly seasoning', price: 80, categoryId: idly.id, prepTime: 10, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Ghee Podi Idly', description: 'Idly drizzled with ghee and spiced podi', price: 80, categoryId: idly.id, prepTime: 5, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Pallipalayam Idly', description: 'Idly with Pallipalayam style spicy seasoning', price: 80, categoryId: idly.id, prepTime: 8, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Mini Idly', description: 'Bite-sized soft idlies with chutney & sambar', price: 50, categoryId: idly.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Podi Idly', description: 'Idly tossed in spiced lentil podi', price: 60, categoryId: idly.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Crispy Idly With Chutney', description: 'Deep-fried crispy idly served with coconut chutney', price: 60, categoryId: idly.id, prepTime: 10, tags: JSON.stringify(['veg']) },
  ]});

  // --- ROAST ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Roast', description: 'Classic dosa-style crispy roast', price: 60, categoryId: roast.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Onion Roast', description: 'Crispy roast with onion filling', price: 80, categoryId: roast.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Masal Roast', description: 'Roast stuffed with spiced potato masala', price: 80, categoryId: roast.id, prepTime: 10, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Mushroom Roast', description: 'Crispy roast with sautéed mushroom filling', price: 90, categoryId: roast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Butter Roast', description: 'Roast cooked with fresh butter', price: 80, categoryId: roast.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Ghee Roast', description: 'Roast made with pure ghee', price: 80, categoryId: roast.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Paneer Roast', description: 'Roast stuffed with spiced paneer', price: 90, categoryId: roast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Podi Roast', description: 'Roast brushed with spicy lentil podi', price: 80, categoryId: roast.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Baby Corn Roast', description: 'Roast with baby corn filling', price: 90, categoryId: roast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Cauliflower Roast', description: 'Roast with spiced cauliflower filling', price: 90, categoryId: roast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Ghee Podi Roast', description: 'Roast with ghee and spiced podi', price: 90, categoryId: roast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
  ]});

  // --- RAVA ROAST ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Rava Roast', description: 'Crispy semolina roast', price: 80, categoryId: ravaRoast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Rava Onion Ghee Roast', description: 'Semolina roast with onion and ghee', price: 110, categoryId: ravaRoast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Rava Onion Roast', description: 'Semolina roast with onion filling', price: 100, categoryId: ravaRoast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Rava Ghee Roast', description: 'Semolina roast cooked with ghee', price: 100, categoryId: ravaRoast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Rava Butter Roast', description: 'Semolina roast cooked with butter', price: 100, categoryId: ravaRoast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Rava Masal Roast', description: 'Semolina roast with spiced potato masala', price: 110, categoryId: ravaRoast.id, prepTime: 12, tags: JSON.stringify(['veg']) },
  ]});

  // --- UTHAPPAM ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Uthappam', description: 'Thick soft pancake made from fermented rice batter', price: 50, categoryId: uthappam.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Onion Uthappam', description: 'Uthappam topped with fresh onion', price: 60, categoryId: uthappam.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Ghee Uthappam', description: 'Uthappam drizzled with ghee', price: 60, categoryId: uthappam.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Butter Uthappam', description: 'Uthappam cooked with fresh butter', price: 60, categoryId: uthappam.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Veg Mix Uthappam', description: 'Uthappam with mixed vegetable toppings', price: 70, categoryId: uthappam.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Podi Uthappam', description: 'Uthappam with spiced lentil podi', price: 60, categoryId: uthappam.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Tomato Uthappam', description: 'Uthappam topped with fresh tomato', price: 70, categoryId: uthappam.id, prepTime: 10, tags: JSON.stringify(['veg']) },
  ]});

  // --- SEVAI ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Tomato Sevai', description: 'Rice noodles tossed with tangy tomato seasoning', price: 60, categoryId: sevai.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Lemon Sevai', description: 'Rice noodles with lemon and mustard tempering', price: 60, categoryId: sevai.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Onion Sevai', description: 'Rice noodles tossed with caramelized onions', price: 60, categoryId: sevai.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Butter Sevai', description: 'Rice noodles with butter', price: 70, categoryId: sevai.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Corn Sevai', description: 'Rice noodles with sweet corn', price: 70, categoryId: sevai.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Paneer Sevai', description: 'Rice noodles with spiced paneer', price: 70, categoryId: sevai.id, prepTime: 10, tags: JSON.stringify(['veg']) },
  ]});

  // --- BREAKFAST ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Pongal', description: 'Creamy rice and lentil porridge with ghee, pepper and cashews', price: 60, categoryId: breakfast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Kichadi', description: 'Soft rice and dal cooked with mild spices', price: 60, categoryId: breakfast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Poori Set', description: 'Fluffy deep-fried pooris with potato masala', price: 50, categoryId: breakfast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Uppuma', description: 'Semolina cooked with vegetables and tempering', price: 60, categoryId: breakfast.id, prepTime: 10, tags: JSON.stringify(['veg']) },
  ]});

  // --- VADAI ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Vadai', description: 'Crispy deep-fried lentil donut', price: 10, categoryId: vadai.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Sambar Vadai', description: 'Vadai soaked in hot sambar', price: 25, categoryId: vadai.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Curd Vadai', description: 'Vadai dipped in creamy fresh curd', price: 35, categoryId: vadai.id, prepTime: 5, tags: JSON.stringify(['veg']) },
  ]});

  // --- LUNCH ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Meals', description: 'Full South Indian meals with rice, sambar, rasam, curries, papad & dessert', price: 110, categoryId: lunch.id, prepTime: 10, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Mini Meals', description: 'Smaller portion meals with essential sides', price: 80, categoryId: lunch.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Veg Biriyani', description: 'Fragrant basmati rice cooked with mixed vegetables and spices', price: 80, categoryId: lunch.id, prepTime: 20, tags: JSON.stringify(['veg']) },
    { name: 'Mushroom Biriyani', description: 'Aromatic basmati rice cooked with fresh mushrooms', price: 90, categoryId: lunch.id, prepTime: 20, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Sambar Rice', description: 'Rice mixed with sambar and ghee', price: 60, categoryId: lunch.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Curd Rice', description: 'Creamy curd mixed rice with tempering', price: 60, categoryId: lunch.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Tomato Rice', description: 'Flavored rice cooked with fresh tomatoes and spices', price: 60, categoryId: lunch.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Lemon Rice', description: 'Rice seasoned with lemon, turmeric and mustard tempering', price: 60, categoryId: lunch.id, prepTime: 5, tags: JSON.stringify(['veg']) },
  ]});

  // --- GRAVY ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Paneer Butter Masala', description: 'Soft paneer in rich butter-tomato gravy', price: 150, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Gobi Masala', description: 'Cauliflower in spiced onion-tomato gravy', price: 150, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg']) },
    { name: 'Kadai Paneer Masala', description: 'Paneer cooked with bell peppers in kadai gravy', price: 150, categoryId: gravy.id, prepTime: 18, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Mushroom Masala', description: 'Fresh mushrooms in spiced onion-tomato gravy', price: 150, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg']) },
    { name: 'Green Peas Masala', description: 'Green peas in rich spiced gravy', price: 150, categoryId: gravy.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Channa Masala', description: 'Chickpeas cooked in tangy tomato-onion gravy', price: 150, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg']) },
    { name: 'Gobi Pepper Masala', description: 'Cauliflower cooked with freshly ground pepper', price: 150, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Mushroom Pepper Masala', description: 'Mushrooms tossed in aromatic black pepper gravy', price: 150, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Paneer Masala', description: 'Paneer in classic spiced tomato gravy', price: 140, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg']) },
    { name: 'Pallipalayam Mushroom Gravy', description: 'Mushrooms cooked in Pallipalayam style fiery gravy', price: 160, categoryId: gravy.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
  ]});

  // --- FRIED RICE ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Veg Fried Rice', description: 'Wok-tossed rice with mixed vegetables', price: 100, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Paneer Fried Rice', description: 'Fried rice with spiced paneer', price: 120, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Mushroom Fried Rice', description: 'Fried rice with fresh mushrooms', price: 120, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Gobi Fried Rice', description: 'Fried rice with crispy cauliflower', price: 120, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Mix Veg Fried Rice', description: 'Fried rice with medley of fresh vegetables', price: 120, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Sweet Corn Fried Rice', description: 'Fried rice with juicy sweet corn', price: 130, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Baby Corn Fried Rice', description: 'Fried rice with tender baby corn', price: 120, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Pallipalayam Mushroom Rice', description: 'Spicy Pallipalayam style mushroom rice', price: 140, categoryId: friedRice.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy', 'bestseller']) },
    { name: 'Pepper Mushroom Rice', description: 'Fried rice with mushrooms and black pepper', price: 140, categoryId: friedRice.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Schezwan Fried Rice', description: 'Spicy Schezwan sauce tossed fried rice', price: 120, categoryId: friedRice.id, prepTime: 12, tags: JSON.stringify(['veg', 'spicy']) },
  ]});

  // --- NOODLES ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Veg Noodles', description: 'Stir-fried noodles with fresh vegetables', price: 80, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Paneer Noodles', description: 'Noodles with spiced paneer', price: 100, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Mushroom Noodles', description: 'Noodles with fresh mushrooms', price: 100, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Cauliflower Noodles', description: 'Noodles with crispy cauliflower', price: 100, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Sweet Corn Noodles', description: 'Noodles with sweet corn', price: 100, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Mixed Veg Noodles', description: 'Noodles tossed with mix of vegetables', price: 100, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Szechuan Veg Noodles', description: 'Spicy Szechuan sauce noodles with vegetables', price: 90, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Szechuan Paneer Noodles', description: 'Spicy Szechuan noodles with paneer', price: 110, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Szechuan Mushroom Noodles', description: 'Spicy Szechuan noodles with mushrooms', price: 110, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Szechuan Cauliflower Noodles', description: 'Spicy Szechuan noodles with cauliflower', price: 110, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Szechuan Sweet Corn Noodles', description: 'Spicy Szechuan noodles with sweet corn', price: 110, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Szechuan Mixed Veg Noodles', description: 'Spicy Szechuan noodles with mixed veggies', price: 130, categoryId: noodles.id, prepTime: 10, tags: JSON.stringify(['veg', 'spicy']) },
  ]});

  // --- DINNER ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Appam', description: 'Soft lacy rice pancake with crispy edges', price: 25, categoryId: dinner.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Butter Appam', description: 'Appam cooked with fresh butter', price: 35, categoryId: dinner.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Ghee Appam', description: 'Appam drizzled with pure ghee', price: 35, categoryId: dinner.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Paniyaram', description: 'Round rice dumplings — crispy outside, soft inside', price: 50, categoryId: dinner.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Idiyappam', description: 'Steamed string hoppers made from rice flour', price: 50, categoryId: dinner.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Chola Poori', description: 'Deep-fried pooris with chickpea curry', price: 90, categoryId: dinner.id, prepTime: 15, tags: JSON.stringify(['veg', 'bestseller']) },
  ]});

  // --- PAROTTA ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Parotta', description: 'Flaky layered flatbread', price: 25, categoryId: parotta.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Chilly Parotta', description: 'Parotta tossed with chilly sauce and vegetables', price: 100, categoryId: parotta.id, prepTime: 12, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Veg Kothu Parotta', description: 'Shredded parotta stir-fried with vegetables and egg', price: 100, categoryId: parotta.id, prepTime: 15, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Pepper Parotta', description: 'Parotta tossed with freshly ground pepper', price: 110, categoryId: parotta.id, prepTime: 12, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Chilly Mushroom Parotta', description: 'Parotta tossed with chilly mushroom', price: 130, categoryId: parotta.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Chilly Gobi Parotta', description: 'Parotta tossed with chilly cauliflower', price: 130, categoryId: parotta.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Sweet Coconut Parotta', description: 'Parotta with sweet coconut filling', price: 45, categoryId: parotta.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Nool Parotta', description: 'Fine string parotta — light and soft', price: 35, categoryId: parotta.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Veg Mix Kothu Parotta', description: 'Shredded parotta with mixed vegetable filling', price: 140, categoryId: parotta.id, prepTime: 18, tags: JSON.stringify(['veg']) },
  ]});

  // --- INDIAN BREADS ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Naan', description: 'Soft leavened bread baked in tandoor', price: 40, categoryId: indianBreads.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Butter Naan', description: 'Naan topped with fresh butter', price: 50, categoryId: indianBreads.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Garlic Naan', description: 'Naan topped with garlic and herbs', price: 70, categoryId: indianBreads.id, prepTime: 8, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Romali', description: 'Paper-thin soft roti', price: 60, categoryId: indianBreads.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Pulka', description: 'Soft whole wheat flatbread', price: 35, categoryId: indianBreads.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Butter Pulka', description: 'Pulka with butter', price: 45, categoryId: indianBreads.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Roti', description: 'Whole wheat flatbread', price: 35, categoryId: indianBreads.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Butter Roti', description: 'Roti with fresh butter', price: 45, categoryId: indianBreads.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Chapati', description: 'Thin whole wheat flatbread', price: 25, categoryId: indianBreads.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Veg Kothu Chapati', description: 'Shredded chapati tossed with vegetables', price: 70, categoryId: indianBreads.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Paneer Kothu Chapati', description: 'Shredded chapati tossed with paneer', price: 100, categoryId: indianBreads.id, prepTime: 12, tags: JSON.stringify(['veg']) },
  ]});

  // --- STARTERS / CHINESE ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Gobi 65', description: 'Crispy deep-fried cauliflower in spicy batter', price: 90, categoryId: starters.id, prepTime: 12, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Mushroom 65', description: 'Crispy deep-fried mushrooms in spicy batter', price: 90, categoryId: starters.id, prepTime: 12, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Paneer 65', description: 'Crispy deep-fried paneer in spicy batter', price: 90, categoryId: starters.id, prepTime: 12, tags: JSON.stringify(['veg', 'spicy', 'bestseller']) },
    { name: 'Baby Corn 65', description: 'Crispy deep-fried baby corn in spicy batter', price: 90, categoryId: starters.id, prepTime: 12, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Gobi Pepper Fry', description: 'Cauliflower tossed with freshly ground pepper', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Mushroom Pepper Fry', description: 'Mushrooms tossed with freshly ground pepper', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Paneer Pepper Fry', description: 'Paneer tossed with freshly ground pepper', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Baby Corn Pepper Fry', description: 'Baby corn tossed with freshly ground pepper', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Gobi Chilly Fry', description: 'Cauliflower tossed in tangy chilly sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Mushroom Chilly Fry', description: 'Mushrooms tossed in tangy chilly sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Paneer Chilly', description: 'Paneer tossed in tangy Indo-Chinese chilly sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy', 'bestseller']) },
    { name: 'Baby Corn Chilly', description: 'Baby corn tossed in tangy chilly sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Gobi Manchurian', description: 'Cauliflower coated in tangy Manchurian sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Mushroom Manchurian', description: 'Mushrooms in tangy Manchurian sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Paneer Manchurian', description: 'Paneer in tangy Manchurian sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Baby Corn Manchurian', description: 'Baby corn in tangy Manchurian sauce', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Pallipalayam Mushroom', description: 'Mushrooms in fiery Pallipalayam style', price: 150, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Pallipalayam Gobi', description: 'Cauliflower in fiery Pallipalayam style', price: 150, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Pallipalayam Paneer', description: 'Paneer in fiery Pallipalayam style', price: 150, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg', 'spicy']) },
    { name: 'Paneer Tikka', description: 'Grilled paneer chunks marinated in spiced yogurt', price: 130, categoryId: starters.id, prepTime: 18, tags: JSON.stringify(['veg', 'bestseller']) },
    { name: 'Paneer Lollipop', description: 'Juicy paneer lollipops in spiced coating', price: 120, categoryId: starters.id, prepTime: 15, tags: JSON.stringify(['veg']) },
    { name: 'Paneer Popcorn', description: 'Bite-sized crispy paneer bites', price: 120, categoryId: starters.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'French Fries', description: 'Golden crispy potato fries with seasoning', price: 80, categoryId: starters.id, prepTime: 10, tags: JSON.stringify(['veg']) },
    { name: 'Paneer Finger', description: 'Crispy paneer fingers — great snack', price: 150, categoryId: starters.id, prepTime: 12, tags: JSON.stringify(['veg']) },
    { name: 'Baby Corn Finger', description: 'Crispy battered baby corn fingers', price: 140, categoryId: starters.id, prepTime: 12, tags: JSON.stringify(['veg']) },
  ]});

  // --- SOUP ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Baby Corn Soup', description: 'Warm soup with tender baby corn in clear broth', price: 80, categoryId: soup.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Veg Soup', description: 'Clear vegetable soup with Chinese spices', price: 80, categoryId: soup.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Corn Soup', description: 'Creamy sweet corn soup', price: 80, categoryId: soup.id, prepTime: 8, tags: JSON.stringify(['veg']) },
    { name: 'Veg Noodles Soup', description: 'Warm noodle soup with vegetables', price: 100, categoryId: soup.id, prepTime: 10, tags: JSON.stringify(['veg']) },
  ]});

  // --- DRINKS & DESSERTS ---
  await prisma.menuItem.createMany({ data: [
    { name: 'Tea', description: 'Hot freshly brewed tea', price: 20, categoryId: drinks.id, prepTime: 3, tags: JSON.stringify(['veg']) },
    { name: 'Coffee', description: 'Hot freshly brewed filter coffee', price: 30, categoryId: drinks.id, prepTime: 3, tags: JSON.stringify(['veg']) },
    { name: 'Horlicks / Boost', description: 'Hot malted health drink', price: 40, categoryId: drinks.id, prepTime: 3, tags: JSON.stringify(['veg']) },
    { name: 'Cool Drinks (200ml)', description: 'Chilled soft drink — 200ml bottle', price: 20, categoryId: drinks.id, prepTime: 1, tags: JSON.stringify(['veg']) },
    { name: 'Cool Drinks (500ml)', description: 'Chilled soft drink — 500ml bottle', price: 40, categoryId: drinks.id, prepTime: 1, tags: JSON.stringify(['veg']) },
    { name: 'Fresh Juice', description: 'Freshly squeezed seasonal fruit juice', price: 50, categoryId: drinks.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Rose Milk / Badam Milk', description: 'Sweet chilled rose milk or badam milk', price: 50, categoryId: drinks.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Ice Cream - Vanilla / Strawberry', description: 'Classic vanilla or strawberry ice cream scoop', price: 50, categoryId: drinks.id, prepTime: 3, tags: JSON.stringify(['veg']) },
    { name: 'Ice Cream - Special Flavours', description: 'Blackcurrant, Alphonso Mango or Italian Chocolate', price: 70, categoryId: drinks.id, prepTime: 3, tags: JSON.stringify(['veg']) },
    { name: 'Fruit Salad', description: 'Fresh mixed seasonal fruit salad', price: 80, categoryId: drinks.id, prepTime: 5, tags: JSON.stringify(['veg']) },
    { name: 'Fruit Salad With Ice Cream', description: 'Fresh fruit salad topped with ice cream', price: 110, categoryId: drinks.id, prepTime: 5, tags: JSON.stringify(['veg', 'bestseller']) },
  ]});

  console.log('✅ Database seeded successfully with menu from PDF!');
  console.log(`  Branch: ${branch.name}`);
  console.log('  Tables: 10');
  console.log('  Categories: 17');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
