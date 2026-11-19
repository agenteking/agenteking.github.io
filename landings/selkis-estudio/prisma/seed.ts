// Seed de servicios, profesionales y horarios. Los datos están en shared/seed-data.ts, que también
// usan la demo estática y el prerender del landing.
//
//   npm run db:seed        → idempotente y NO destructivo: solo agrega lo que falta (servicios y
//                            profesionales por id; horarios solo si la tabla está vacía). Nunca pisa lo
//                            que el cliente editó desde el panel (precios, nombres, activo/inactivo, quién
//                            hace qué) ni toca turnos. Se puede correr las veces que haga falta.
//   npm run db:seed:reset  → BORRA TODO (turnos, historial, servicios, profesionales y horarios) y vuelve
//                            a cargar el seed. Solo para desarrollo o la demo: nunca contra la base de un cliente.
//
// Ojo: un servicio o una profesional del seed que se ELIMINÓ desde el panel vuelve a aparecer con el
// próximo seed (si solo se desactivó, queda desactivado). Los horarios no vuelven: un día sin fila es
// un día cerrado, por eso solo se cargan si la tabla está vacía.
import "dotenv/config";
import { prisma } from "../server/src/db.js";
import { SEED_HOURS, SEED_PROFESSIONALS, SEED_SERVICES } from "../shared/seed-data.js";

const reset = process.argv.includes("--reset");

async function main() {
  if (reset) {
    const [events, bookings] = await prisma.$transaction([
      prisma.bookingEvent.deleteMany(),
      prisma.booking.deleteMany(),
      prisma.professional.deleteMany(),
      prisma.service.deleteMany(),
      prisma.businessHour.deleteMany(),
    ]);
    console.log(`--reset: borrados ${bookings.count} turnos (${events.count} eventos), servicios, profesionales y horarios.`);
  }

  const added = { services: 0, professionals: 0, hours: 0 };
  await prisma.$transaction(async (tx) => {
    const services = new Set((await tx.service.findMany({ select: { id: true } })).map((s) => s.id));
    const pros = new Set((await tx.professional.findMany({ select: { id: true } })).map((p) => p.id));
    for (const [i, s] of SEED_SERVICES.entries()) {
      if (services.has(s.id)) continue;
      // Servicio nuevo: se conecta con las profesionales del seed que lo hacen y ya existen.
      const links = SEED_PROFESSIONALS.filter((p) => pros.has(p.id) && p.services.includes(s.id)).map((p) => ({ id: p.id }));
      await tx.service.create({ data: { ...s, sortOrder: i, active: true, professionals: { connect: links } } });
      added.services++;
    }
    for (const [i, p] of SEED_PROFESSIONALS.entries()) {
      if (pros.has(p.id)) continue;
      await tx.professional.create({
        data: {
          id: p.id,
          name: p.name,
          specialty: p.specialty,
          sortOrder: i,
          active: true,
          services: { connect: p.services.map((id) => ({ id })) },
        },
      });
      added.professionals++;
    }
    if ((await tx.businessHour.count()) === 0) {
      await tx.businessHour.createMany({ data: SEED_HOURS });
      added.hours = SEED_HOURS.length;
    }
  });
  console.log(
    `Seed OK: agregados ${added.services} servicios, ${added.professionals} profesionales y ${added.hours} días con horario` +
      (reset ? "." : " (lo que ya estaba no se tocó)."),
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
