const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/userModel');
const Expense = require('./models/expenseModel');
const Category = require('./models/categoryModel');
const Group = require('./models/groupModel'); 
const { nanoid } = require('nanoid');          
const PORT = 1812;

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect('mongodb://127.0.0.1:27017/expense_tracker')
    .then(() => console.log(" MongoDB Connected"))
    .catch(err => console.log(" MongoDB Error:", err));



app.get('/', (req, res) => {
    res.render('index');
});



app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password, email, phone } = req.body;
        const user = new User({ username, password, email, phone });
        await user.save();
        res.redirect('/login');
    } catch (err) {
        res.send(" Error: " + err.message);
    }
});







app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) return res.send(" Invalid username or password");

    req.session.user = user;
    res.redirect('/expenses');
});

app.get('/logout', (req, res) => {
    req.session.user = null;
    res.redirect('/');
});






app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('profile', { user: req.session.user });
});

app.post('/profile', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { username, email, phone, password } = req.body;

    try {
        await User.updateOne(
            { _id: req.session.user._id },
            { username, email, phone, password }
        );

        req.session.user = await User.findById(req.session.user._id);
        res.redirect('/expenses');
    } catch (err) {
        res.send("Error updating profile: " + err.message);
    }
});









app.get('/groups', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const groups = await Group.find({ members: req.session.user._id });

    res.render('groups', {
        username: req.session.user.username,
        groups
    });
});


app.post('/groups/create', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const joinCode = nanoid(6).toUpperCase();

    const group = new Group({
        name: req.body.name,
        joinCode,
        createdBy: req.session.user._id,
        members: [req.session.user._id]
    });

    await group.save();
    res.redirect('/groups');
});

app.post('/groups/join', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const code = req.body.joinCode.trim().toUpperCase();
    const group = await Group.findOne({ joinCode: code });

    if (!group) return res.send("Invalid group code!");

    if (!group.members.includes(req.session.user._id)) {
        group.members.push(req.session.user._id);
        await group.save();
    }

    res.redirect('/groups');
});



app.get('/groups/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const groupId = req.params.id;

    const group = await Group.findById(groupId)
        .populate("members", "username email");

    if (!group) return res.send("Group not found");

    const groupExpenses = await Expense.find({ groupId })
        .populate("category")
        .populate("userId", "username email");

  
const members = group.members;
const totalMembers = members.length;

let balance = {};
members.forEach(m => balance[m._id] = 0);

groupExpenses.forEach(exp => {
    const payerId = exp.userId._id.toString();
    const amount = exp.amount;
    const share = amount / totalMembers;

 
    balance[payerId] += amount;


    members.forEach(m => {
        balance[m._id] -= share;
    });

    exp.paidBy.forEach(uid => {
        const userIdStr = uid.toString();


        balance[userIdStr] += share;

        balance[payerId] -= share;
    });
});

    res.render("groupDetail", {
        username: req.session.user.username,
        userId: req.session.user._id,  
        group,
        groupExpenses,
        members,
        balance
    });
});


app.get('/group-expenses/edit/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const expense = await Expense.findById(req.params.id)
        .populate("category")
        .populate("groupId");

    if (!expense) return res.send("Expense not found");

    if (expense.userId.toString() !== req.session.user._id.toString()) {
        return res.send("You cannot edit this expense.");
    }

    const categories = await Category.find({});
    
    res.render("editGroupExpense", {
        expense,
        categories,
        username: req.session.user.username
    });
});


app.post('/group-expenses/edit/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const expense = await Expense.findById(req.params.id);

    if (!expense) return res.send("Expense not found");

    if (expense.userId.toString() !== req.session.user._id.toString()) {
        return res.send("You cannot edit this expense.");
    }

    await Expense.updateOne(
        { _id: req.params.id },
        {
            title: req.body.title,
            amount: req.body.amount,
            category: req.body.category,
            date: req.body.date
        }
    );

    res.redirect('/groups/' + expense.groupId);
});

app.get('/group-expenses/delete/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const expense = await Expense.findById(req.params.id);

    if (!expense) return res.send("Expense not found");

    if (expense.userId.toString() !== req.session.user._id.toString()) {
        return res.send("You cannot delete this expense.");
    }

    const groupId = expense.groupId;

    await Expense.deleteOne({ _id: req.params.id });

    res.redirect('/groups/' + groupId);
});










app.get('/categories', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const categories = await Category.find();
    res.render('categories', { categories, username: req.session.user.username });
});

app.post('/categories/add', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const { name } = req.body;
    if (!name.trim()) return res.send(" Category name required");

    await Category.create({ name });
    res.redirect('/categories');
});

app.post('/categories/edit/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    await Category.updateOne({ _id: req.params.id }, { name: req.body.name });
    res.redirect('/categories');
});

app.get('/categories/delete/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    await Category.deleteOne({ _id: req.params.id });
    res.redirect('/categories');
});











app.get('/expenses', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const filter = {
        userId: req.session.user._id,
        groupId: null  
    };

    if (req.query.categoryId) {
        filter.category = req.query.categoryId;
    }

    let search = "";
    if (req.query.search && req.query.search.trim() !== "") {
        search = req.query.search.trim();
        filter.title = new RegExp(search, "i");
    }

    const categories = await Category.find({});
    const groups = await Group.find({ members: req.session.user._id });

    const expenses = await Expense.find(filter)
        .populate("category");

    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    res.render('expenses', {
        expenses,
        username: req.session.user.username,
        total,
        categories,
        groups,
        selectedCategory: req.query.categoryId || "",
        search
    });
});


app.get('/expenses/add', async (req, res) => {
    const categories = await Category.find({});
    const groups = await Group.find({ members: req.session.user._id });

    res.render('addExpense', { 
        username: req.session.user.username,
        categories,
        groups,
        selectedGroup: req.query.group || ""   
    });
});



app.post('/expenses/add', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const groupId = req.body.groupId || null;

    const newExpense = new Expense({
        title: req.body.title,
        amount: req.body.amount,
        category: req.body.category,
        date: req.body.date,
        userId: req.session.user._id,
        groupId: groupId
    });

    await newExpense.save();

    if (groupId) {
        return res.redirect('/groups/' + groupId);
    }

    res.redirect('/expenses');
});


app.get('/expenses/pay/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.send("Expense not found");

    if (!expense.paidBy.includes(req.session.user._id)) {
        expense.paidBy.push(req.session.user._id);
        await expense.save();
    }

    if (expense.groupId) return res.redirect("/groups/" + expense.groupId);
    res.redirect("/expenses");
});



app.get('/expenses/unpay/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.send("Expense not found");

    expense.paidBy = expense.paidBy.filter(u => 
        u.toString() !== req.session.user._id.toString()
    );

    await expense.save();

    if (expense.groupId) return res.redirect("/groups/" + expense.groupId);
    res.redirect("/expenses");
});


app.get('/expenses/edit/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const expense = await Expense.findOne({
        _id: req.params.id,
        userId: req.session.user._id
    });

    if (!expense) return res.send(" Expense not found");

    const categories = await Category.find({});
    const groups = await Group.find({ members: req.session.user._id });

    res.render('editExpense', {
        expense,
        categories,
        groups,
        username: req.session.user.username
    });
});

app.post('/expenses/edit/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    await Expense.updateOne(
        { _id: req.params.id, userId: req.session.user._id },
        {
            title: req.body.title,
            amount: req.body.amount,
            category: req.body.category,
            date: req.body.date,
            groupId: req.body.groupId || null
        }
    );

    res.redirect('/expenses');
});


app.get('/expenses/delete/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    await Expense.deleteOne({ _id: req.params.id, userId: req.session.user._id });
    res.redirect('/expenses');
});

app.listen(PORT, () => console.log(` Server running on ${PORT}`));
