import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Өндіріс бастығы тапсырыс ішіне ұсақ тапсырма жасайды және цех маманына береді */
  async createTask(data: {
    orderId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    deadline?: string;
  }) {
    const order = await this.prisma.order.findUnique({ where: { id: data.orderId } });
    if (!order) throw new NotFoundException('Тапсырыс табылмады');

    const task = await this.prisma.productionTask.create({
      data: {
        orderId: data.orderId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        deadline: data.deadline ? new Date(data.deadline) : null,
      },
    });

    if (data.assigneeId) {
      await this.notifications.notifyUser(
        data.assigneeId,
        'TASK_ASSIGNED',
        'Сізге жаңа тапсырма берілді',
        `${task.title}\nТапсырыс: №${order.tenderNumber}`,
        order.id,
      );
    }

    return task;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, userId: string) {
    const task = await this.prisma.productionTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Тапсырма табылмады');

    return this.prisma.productionTask.update({
      where: { id: taskId },
      data: {
        status,
        startedAt: status === TaskStatus.IN_PROGRESS && !task.startedAt ? new Date() : task.startedAt,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  async getMyTasks(userId: string) {
    return this.prisma.productionTask.findMany({
      where: { assigneeId: userId, status: { not: TaskStatus.COMPLETED } },
      include: { order: { select: { tenderNumber: true, productName: true, deadline: true } } },
      orderBy: { deadline: 'asc' },
    });
  }
}
