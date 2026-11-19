// Seed de servicios, profesionales y horarios.
// Precios ORIENTATIVOS de muestra: Selkis no publica lista de precios; confirmar con el estudio.
import "dotenv/config";
import { prisma } from "../server/src/db.js";

const services = [
  { id: "semi-manos", category: "Uñas", name: "Esmaltado semipermanente", description: "Manos, con preparación de cutícula y limado. Gran paleta de colores.", durationMin: 60, priceFrom: 18000 },
  { id: "kapping-gel", category: "Uñas", name: "Kapping gel", description: "Gel sobre la uña natural para que crezca fuerte. Pensado para durar hasta 20 días.", durationMin: 90, priceFrom: 24000 },
  { id: "esculpidas", category: "Uñas", name: "Uñas esculpidas", description: "Extensión esculpida en gel o acrílico, con la forma y el largo que quieras.", durationMin: 120, priceFrom: 32000 },
  { id: "nail-art", category: "Uñas", name: "Semi + nail art", description: "Semipermanente con diseño a medida: traé tu idea y la hacemos realidad.", durationMin: 90, priceFrom: 23000 },
  { id: "pies-semi", category: "Pies", name: "Pedicuría con semipermanente", description: "Pies en seco, cutículas, durezas y esmaltado semipermanente.", durationMin: 60, priceFrom: 22000 },
  { id: "lifting-pestanas", category: "Cejas & pestañas", name: "Lifting de pestañas", description: "Curvatura y tinte para una mirada abierta, sin extensiones.", durationMin: 60, priceFrom: 22000 },
  { id: "perfilado-cejas", category: "Cejas & pestañas", name: "Perfilado de cejas", description: "Diseño según tu rostro, con pinza y/o cera.", durationMin: 30, priceFrom: 12000 },
  { id: "laser-zona-chica", category: "Depilación láser", name: "Láser · zona chica", description: "Axilas, bozo, cavado simple u otra zona chica, por sesión.", durationMin: 30, priceFrom: 15000 },
  { id: "laser-piernas", category: "Depilación láser", name: "Láser · piernas completas", description: "Sesión de piernas enteras. Consultá por packs.", durationMin: 60, priceFrom: 38000 },
];

// Nombres de muestra (no son el staff real).
const professionals = [
  { id: "pro-a", name: "Profesional A", specialty: "Uñas & nail art", services: ["semi-manos", "kapping-gel", "esculpidas", "nail-art", "pies-semi"] },
  { id: "pro-b", name: "Profesional B", specialty: "Uñas & pies", services: ["semi-manos", "kapping-gel", "nail-art", "pies-semi"] },
  { id: "pro-c", name: "Profesional C", specialty: "Cejas, pestañas & láser", services: ["lifting-pestanas", "perfilado-cejas", "laser-zona-chica", "laser-piernas"] },
];

// Horarios publicados en su ficha de Google Maps (lunes 13–19, mar–vie 9–19, sáb 9–18).
const hours = [
  { weekday: 1, open: "13:00", close: "19:00" },
  { weekday: 2, open: "09:00", close: "19:00" },
  { weekday: 3, open: "09:00", close: "19:00" },
  { weekday: 4, open: "09:00", close: "19:00" },
  { weekday: 5, open: "09:00", close: "19:00" },
  { weekday: 6, open: "09:00", close: "18:00" },
];

async function main() {
  for (const [i, s] of services.entries()) {
    await prisma.service.upsert({ where: { id: s.id }, create: { ...s, sortOrder: i }, update: { ...s, sortOrder: i } });
  }
  for (const p of professionals) {
    const links = p.services.map((id) => ({ id }));
    await prisma.professional.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name, specialty: p.specialty, services: { connect: links } },
      update: { name: p.name, specialty: p.specialty, services: { set: links } },
    });
  }
  await prisma.businessHour.deleteMany();
  await prisma.businessHour.createMany({ data: hours });
  console.log(`Seed OK: ${services.length} servicios, ${professionals.length} profesionales, ${hours.length} días con horario.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
