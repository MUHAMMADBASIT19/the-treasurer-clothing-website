const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SQLite Database Setup
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
});

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Product Model
const Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    discountPercent: { type: DataTypes.INTEGER, defaultValue: 0 },
    isSoldOut: { type: DataTypes.BOOLEAN, defaultValue: false },
    description: { type: DataTypes.TEXT },
    images: { type: DataTypes.TEXT }
});

// Order Model
const Order = sequelize.define('Order', {
    customerName: { type: DataTypes.STRING, allowNull: false },
    customerEmail: { type: DataTypes.STRING, defaultValue: 'guest@treasurer.com' },
    phone: { type: DataTypes.STRING, allowNull: false },
    city: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.TEXT, allowNull: false },
    paymentMethod: { type: DataTypes.STRING, defaultValue: 'COD' },
    items: { type: DataTypes.TEXT, allowNull: false },
    totalAmount: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'Pending' }
});

// Coupon Model
const Coupon = sequelize.define('Coupon', {
    code: { type: DataTypes.STRING, unique: true, allowNull: false },
    discountPercent: { type: DataTypes.INTEGER, allowNull: false }
});

// User Model for Login / Registration
const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'customer' }
});

// Sync Database
sequelize.sync().then(() => console.log('Database synced successfully!'));

// --- ROUTES ---

// Login Route (Strict Admin Enforcement)
app.post('/api/login', async (req, res) => {
    try {
        let { email, password, role } = req.body;
        
        email = email ? email.trim().toLowerCase() : '';
        password = password ? password.trim() : '';

        // Force Admin access if email matches or role requested is Admin with correct password
        if ((email === 'admin@treasurer.com' && password === 'admin123') || (role === 'Admin' && password === 'admin123')) {
            return res.json({ 
                message: 'Login successful',
                token: 'mock-admin-token-12345',
                user: { 
                    id: 1,
                    name: 'Admin', 
                    email: 'admin@treasurer.com', 
                    role: 'Admin' 
                } 
            });
        }

        const user = await User.findOne({ where: { email } });
        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid email or password', error: 'Invalid email or password' });
        }

        res.json({ 
            message: 'Login successful',
            token: 'mock-user-token-' + user.id,
            user 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during login', error: 'Server error' });
    }
});

// Register Route
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const newUser = await User.create({ 
            name, 
            email: email ? email.trim().toLowerCase() : '', 
            password, 
            role: role || 'customer' 
        });
        res.status(201).json({ message: 'Registered successfully', success: true, user: newUser });
    } catch (err) {
        res.status(400).json({ message: 'Email already registered or invalid data', error: 'Email already registered or invalid data' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.findAll({ order: [['createdAt', 'DESC']] });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/products', upload.array('images'), async (req, res) => {
    try {
        const { name, price, discountPercent, isSoldOut, description } = req.body;
        const imagePaths = req.files ? req.files.map(file => file.path.replace(/\\/g, '/')) : [];
        
        const product = await Product.create({
            name,
            price: parseFloat(price),
            discountPercent: parseInt(discountPercent) || 0,
            isSoldOut: isSoldOut === 'true',
            description,
            images: JSON.stringify(imagePaths)
        });
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create product' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.findAll({ order: [['createdAt', 'DESC']] });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, customerEmail, phone, city, address, paymentMethod, items, totalAmount, customer } = req.body;
        
        const newOrder = await Order.create({
            customerName: customerName || (customer ? customer.name : 'N/A'),
            customerEmail: customerEmail || (customer ? customer.email : 'guest@treasurer.com'),
            phone: phone || (customer ? customer.phone : 'N/A'),
            city: city || (customer ? customer.city : 'N/A'),
            address: address || (customer ? customer.address : 'N/A'),
            paymentMethod: paymentMethod || 'COD',
            items: typeof items === 'string' ? items : JSON.stringify(items || []),
            totalAmount: parseFloat(totalAmount) || 0,
            status: 'Pending'
        });

        res.status(201).json(newOrder);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const { status } = req.body;
        await Order.update({ status }, { where: { id: req.params.id } });
        res.json({ message: 'Order status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await Order.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Order deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.findAll();
        res.json(coupons);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/coupons', async (req, res) => {
    try {
        const { code, discountPercent } = req.body;
        const coupon = await Coupon.create({ code, discountPercent });
        res.json(coupon);
    } catch (err) { res.status(400).json({ error: 'Coupon code already exists' }); }
});

app.delete('/api/coupons/:id', async (req, res) => {
    try {
        await Coupon.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));