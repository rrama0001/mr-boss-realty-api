const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

exports.getAll = async (req, res) => {
  try {
    const properties = await prisma.property.findMany()
    res.json(properties)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.getOne = async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: Number(req.params.id) }
    })
    if (!property) return res.status(404).json({ error: 'Property not found' })
    res.json(property)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.create = async (req, res) => {
  try {
    const { name, location, description, project_type, completion_date, total_units } = req.body;

    const property = await prisma.property.create({
        data: {
            name,
            location,
            description,
            project_type,
            completion_date,
            total_units
        }
    }); 
    res.json(property)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.update = async (req, res) => {
  try {
    const { company, rooms, area, unitPrice } = req.body
    const property = await prisma.property.update({
      where: { id: Number(req.params.id) },
      data: { company, rooms, area, unitPrice }
    })
    res.json(property)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

exports.remove = async (req, res) => {
  try {
    await prisma.property.delete({
      where: { id: Number(req.params.id) }
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
