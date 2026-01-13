import { Injectable } from '@nestjs/common';

export interface DashboardResponse {
  status: 'ok';
  message: string;
}

@Injectable()
export class DashboardService {
  /**
   * Get dashboard data (currently empty)
   */
  async getDashboard(userId: string): Promise<DashboardResponse> {
    // Future: Add real dashboard metrics, connected stores, etc.
    return {
      status: 'ok',
      message: 'Dashboard endpoint ready. More features coming soon.',
    };
  }
}
