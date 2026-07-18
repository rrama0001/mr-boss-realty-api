const { PrismaClient } = require('@prisma/client');
const { createSoftDeleteExtension } = require('../services/softDelete');

const prisma = new PrismaClient().$extends(createSoftDeleteExtension());

module.exports = { prisma };
