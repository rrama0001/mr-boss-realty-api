import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /units
 * Fetch all units (optionally filter via query params)
 */
export const getUnits = async (req, res) => {
    try {
        const filters = {};

        // Dynamically build Prisma filters from query params
        for (const [key, value] of Object.entries(req.query)) {
            if (value !== undefined && value !== "") {
                filters[key] = isNaN(value) ? value : Number(value);
            }
        }

        const units = await prisma.units.findMany({
            where: Object.keys(filters).length ? filters : undefined,
            include: {
                projects: true,
                buildings: true,
            },
            orderBy: { created_at: "desc" }
        });

        res.json(units);
    } catch (error) {
        console.error("Error fetching units:", error);
        res.status(500).json({ error: "Failed to fetch units" });
    }
};

/**
 * PUT /units/:id
 * Update a specific unit
 */
export const updateUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            project_id,
            building_id,
            ...rest
        } = req.body;

        // Prepare update data safely
        const data = {
            ...rest,
            projects: project_id
                ? { connect: { id: Number(project_id) } }
                : undefined,
            buildings: building_id
                ? { connect: { id: Number(building_id) } }
                : { disconnect: true },
        };

        const updatedUnit = await prisma.units.update({
            where: { id: Number(id) },
            data,
            include: {
                projects: true,
                buildings: true,
            },
        });

        res.json(updatedUnit);
    } catch (error) {
        console.error("Error updating unit:", error);
        res.status(500).json({ error: "Failed to update unit" });
    }
};
