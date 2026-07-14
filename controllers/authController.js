const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username, password: hashed }
    })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.login = (req, res) => {
  res.json({ message: 'Logged in', user: req.user })
}

exports.logout = (req, res) => {
  req.logout(() => {
    res.json({ message: 'Logged out' })
  })
}
