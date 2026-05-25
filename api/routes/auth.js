const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { dni, password } = req.body;
    if (!dni || !password) {
      return res.status(400).json({ error: 'DNI y contraseña requeridos' });
    }
    const user = await User.findOne({ dni });
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = jwt.sign(
      { dni: user.dni, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      token,
      user: {
        dni: user.dni,
        nombre: user.nombre,
        email: user.email,
        isAdmin: user.isAdmin,
        paid: user.paid
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { dni, nombre, email, password, paid } = req.body;
    if (!dni || !nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos requeridos' });
    }
    const exists = await User.findOne({ dni });
    if (exists) {
      return res.status(400).json({ error: 'DNI ya existe' });
    }
    const user = await User.create({
      dni,
      nombre,
      email,
      password,
      paid: paid || false
    });
    res.status(201).json({
      user: {
        dni: user.dni,
        nombre: user.nombre,
        email: user.email,
        paid: user.paid
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
