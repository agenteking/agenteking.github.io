// Seed de servicios, profesionales y horarios (idempotente). Los datos están en shared/seed-data.ts,
// que también usan la demo estática y el prerender del landing.
// Re-seedear pisa nombre/precio/etc. de los ids del seed, pero no toca lo creado desde el panel.
import "dotenv/config";
import { prisma } from "../server/src/db.js";
import { SEED_HOURS, SEED_PROFESSIONALS, SEED_SERVICES } from "../shared/seed-data.js";

async function main() {
  for (const [i, s] of SEED_SERVICES.entries()) {
    const data = { ...s, sortOrder: i, active: true };
    await prisma.service.upsert({ where: { id: s.id }, create: data, update: data });
  }
  for (const [i, p] of SEED_PROFESSIONALS.entries()) {
    const links = p.services.map((id) => ({ id }));
    const data = { name: p.name, specialty: p.specialty, sortOrder: i, active: true };
    await prisma.professional.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data, services: { connect: links } },
      update: { ...data, services: { set: links } },
    });
  }
  await prisma.businessHour.deleteMany();
  await prisma.businessHour.createMany({ data: SEED_HOURS });
  console.log(
    `Seed OK: ${SEED_SERVICES.length} servicios, ${SEED_PROFESSIONALS.length} profesionales, ${SEED_HOURS.length} días con horario.`,
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
