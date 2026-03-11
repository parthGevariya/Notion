const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking Reminder model fields...');
  const reminder = await prisma.reminder.findFirst();
  if (reminder) {
    console.log('Sample reminder found:', Object.keys(reminder));
  } else {
    console.log('No reminders found to check keys, trying to create a dry-run object...');
    try {
      // Just check the client types if possible or try to access fields
      console.log('Fields in dmmf?', prisma._runtimeDataModel?.models?.Reminder?.fields?.map(f => f.name));
    } catch(e) {
      console.log('Could not reflect on DMMF');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
