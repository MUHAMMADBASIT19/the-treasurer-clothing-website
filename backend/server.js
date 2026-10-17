const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Sequelize, DataTypes } = require('sequelize');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

// Nodemailer Transporter Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'yourbrandemail@gmail.com',
        pass: 'your-app-password'
    }
});

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

// User Model with Email Verification Fields
const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'customer' },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    verificationToken: { type: DataTypes.STRING, allowNull: true }
});

// Wishlist Model
const Wishlist = sequelize.define('Wishlist', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false }
});

// Sync Database
sequelize.sync().then(() => console.log('Database synced successfully!'));

// --- ROUTES ---

// REGISTER ROUTE WITH EMAIL VERIFICATION TOKEN
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const formattedEmail = email ? email.trim().toLowerCase() : '';

        const existingUser = await User.findOne({ where: { email: formattedEmail } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered', error: 'Email already registered' });
        }

        const token = crypto.randomBytes(32).toString('hex');

        const newUser = await User.create({ 
            name, 
            email: formattedEmail, 
            password, 
            role: role || 'customer',
            isVerified: false,
            verificationToken: token
        });

        const verifyLink = `http://localhost:5000/api/verify-email/${token}`;

        const mailOptions = {
            from: '"The Treasurer" <no-reply@treasurer.com>',
            to: formattedEmail,
            subject: 'Verify Your Email - The Treasurer',
            html: `
                <div style="background:#030304; color:#fff; padding:30px; font-family:sans-serif; text-align:center;">
                    <h2 style="color:#d4af37;">THE TREASURER</h2>
                    <p>Welcome, <strong>${name}</strong>!</p>
                    <p>Please verify your account email address by clicking the link below:</p>
                    <a href="${verifyLink}" style="background:#d4af37; color:#000; padding:12px 25px; text-decoration:none; font-weight:bold; display:inline-block; margin:20px 0; border-radius:4px;">VERIFY MY ACCOUNT</a>
                    <p style="font-size:12px; color:#888;">If you didn't register on The Treasurer, ignore this email.</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.log('Mail send error / fallback link:', verifyLink);
        });

        console.log('--- VERIFICATION LINK (TESTING) ---');
        console.log(verifyLink);
        console.log('------------------------------------');

        res.status(201).json({ 
            message: 'Registration successful! Verification email sent.', 
            success: true,
            verifyLink: verifyLink 
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: 'Registration failed or email already exists', error: err.message });
    }
});

// EMAIL VERIFICATION ENDPOINT
app.get('/api/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({ where: { verificationToken: token } });

        if (!user) {
            return res.send(`
                <body style="background:#030304; color:#ff4d4d; font-family:sans-serif; text-align:center; padding:50px;">
                    <h2>Invalid or Expired Verification Token</h2>
                    <a href="http://127.0.0.1:5500/login.html" style="color:#d4af37;">Go to Login</a>
                </body>
            `);
        }

        user.isVerified = true;
        user.verificationToken = null;
        await user.save();

        res.send(`
            <body style="background:#030304; color:#fff; font-family:sans-serif; text-align:center; padding:50px;">
                <h1 style="color:#d4af37;">THE TREASURER</h1>
                <h2>Account Verified Successfully! 🎉</h2>
                <p>Your email has been verified. You can now login to your account.</p>
                <a href="http://127.0.0.1:5500/login.html" style="background:#d4af37; color:#000; padding:10px 20px; text-decoration:none; font-weight:bold; border-radius:4px; display:inline-block; margin-top:15px;">PROCEED TO LOGIN</a>
            </body>
        `);
    } catch (err) {
        res.status(500).send('Server Error during verification');
    }
});

// LOGIN ROUTE WITH ROLE & VERIFICATION CHECK
app.post('/api/login', async (req, res) => {
    try {
        let { email, password, role } = req.body;
        
        email = email ? email.trim().toLowerCase() : '';
        password = password ? password.trim() : '';

        // Check if user is trying to login as Admin
        if (role === 'Admin' || role === 'admin') {
            if ((email === 'admin@treasurer.com' && password === 'admin123') || password === 'admin123') {
                return res.json({ 
                    message: 'Login successful',
                    token: 'mock-admin-token-12345',
                    user: { id: 1, name: 'Admin', email: 'admin@treasurer.com', role: 'Admin', isVerified: true } 
                });
            } else {
                return res.status(401).json({ message: 'Invalid Admin credentials' });
            }
        }

        // If role is Customer (or anything else), check in User database
        const user = await User.findOne({ where: { email } });
        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Prevent logging into customer portal if role mismatch
        if (user.role === 'Admin') {
            return res.status(403).json({ message: 'Admin credentials cannot be used under Customer role. Please select Admin role.' });
        }

        if (!user.isVerified) {
            return res.status(403).json({ message: 'Please verify your email address before logging in!' });
        }

        res.json({ 
            message: 'Login successful',
            token: 'mock-user-token-' + user.id,
            user 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// PRODUCTS ROUTES
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.findAll({ order: [['createdAt', 'DESC']] });
        res.json(products);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/products', upload.array('images'), async (req, res) => {
    try {
        const { name, price, discountPercent, isSoldOut, description } = req.body;
        const imagePaths = req.files ? req.files.map(file => file.path.replace(/\\/g, '/')) : [];
        const product = await Product.create({
            name, price: parseFloat(price),
            discountPercent: parseInt(discountPercent) || 0,
            isSoldOut: isSoldOut === 'true', description,
            images: JSON.stringify(imagePaths)
        });
        res.status(201).json(product);
    } catch (err) { res.status(500).json({ error: 'Failed to create product' }); }
});

app.put('/api/products/:id', upload.array('images'), async (req, res) => {
    try {
        const { name, price, discountPercent, isSoldOut, description } = req.body;
        const product = await Product.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        let soldOutStatus = product.isSoldOut;
        if (isSoldOut !== undefined && isSoldOut !== null) {
            soldOutStatus = (isSoldOut === 'true' || isSoldOut === true || isSoldOut === 'Sold Out (Out of Stock)');
        }

        let updatedFields = {
            name: name !== undefined ? name : product.name,
            price: price !== undefined ? parseFloat(price) : product.price,
            discountPercent: discountPercent !== undefined ? parseInt(discountPercent) : product.discountPercent,
            isSoldOut: soldOutStatus,
            description: description !== undefined ? description : product.description
        };

        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.path.replace(/\\/g, '/'));
            updatedFields.images = JSON.stringify(newImages);
        }

        await product.update(updatedFields);
        res.json({ message: 'Product updated successfully', product });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: 'Failed to update product' }); 
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Product deleted' });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ORDERS ROUTES
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.findAll({ order: [['createdAt', 'DESC']] });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch orders' }); }
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
    } catch (err) { res.status(500).json({ error: 'Failed to place order' }); }
});

// WISHLIST ROUTES
app.get('/api/wishlist/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const wishlistItems = await Wishlist.findAll({ where: { userId } });
        const productIds = wishlistItems.map(item => item.productId);
        const products = await Product.findAll({ where: { id: productIds } });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch wishlist' });
    }
});

app.post('/api/wishlist', async (req, res) => {
    try {
        const { userId, productId } = req.body;
        if (!userId || !productId) {
            return res.status(400).json({ message: 'User ID and Product ID required' });
        }
        const existing = await Wishlist.findOne({ where: { userId, productId } });
        if (existing) {
            return res.status(400).json({ message: 'Product already in wishlist' });
        }
        const wishlistItem = await Wishlist.create({ userId, productId });
        res.status(201).json({ message: 'Added to wishlist', wishlistItem });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add to wishlist' });
    }
});

app.delete('/api/wishlist/:userId/:productId', async (req, res) => {
    try {
        const { userId, productId } = req.params;
        await Wishlist.destroy({ where: { userId, productId } });
        res.json({ message: 'Removed from wishlist' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update wishlist' });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));