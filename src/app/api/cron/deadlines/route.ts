import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
    try {
        const now = new Date();
        const tasks = await prisma.reminder.findMany({
            where: {
                status: { in: ['pending', 'in_progress', 'changes_requested'] },
                OR: [
                    { notif1Sent: false },
                    { notif2Sent: false },
                    { notif3Sent: false }
                ]
            }
        });

        const notificationsToSend = [];

        for (const task of tasks) {
            const hoursLeft = (new Date(task.endDate).getTime() - now.getTime()) / (1000 * 60 * 60);

            let shouldNotify = false;
            let message = '';
            let updateField = '';

            if (hoursLeft <= 0 && !task.notif3Sent) {
                shouldNotify = true;
                message = `🔴 OVERDUE: Task "${task.title}" has passed its deadline!`;
                updateField = 'notif3Sent';
                await prisma.reminder.update({ where: { id: task.id }, data: { status: 'overdue' } });
            } else if (hoursLeft <= 12 && hoursLeft > 0 && !task.notif2Sent) {
                shouldNotify = true;
                message = `⏳ Due Soon: Task "${task.title}" is due in less than 12 hours.`;
                updateField = 'notif2Sent';
            } else if (hoursLeft <= 24 && hoursLeft > 12 && !task.notif1Sent) {
                shouldNotify = true;
                message = `📅 Reminder: Task "${task.title}" is due in 24 hours.`;
                updateField = 'notif1Sent';
            }

            if (shouldNotify) {
                const notif = await prisma.notification.create({
                    data: {
                        userId: task.assigneeId,
                        title: 'Task Deadline Approaching',
                        message,
                        type: 'task',
                        link: '/reminders'
                    }
                });

                await prisma.reminder.update({
                    where: { id: task.id },
                    data: { [updateField]: true }
                });

                notificationsToSend.push({ userId: task.assigneeId, payload: notif });
            }
        }

        return NextResponse.json(notificationsToSend);
    } catch (error) {
        console.error('Error processing deadline cron:', error);
        return NextResponse.json({ error: 'Failed to process deadlines' }, { status: 500 });
    }
}
