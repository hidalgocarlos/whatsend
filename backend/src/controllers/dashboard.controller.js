import * as dashboardService from '../services/dashboard.service.js';
import * as usageService from '../services/usage.service.js';
import { getStatus } from '../services/whatsappPool.service.js';

export async function summary(req, res) {
  try {
    const data = await dashboardService.getSummary(req.user.id);
    const wa = getStatus(req.user.id);
    res.json({ ...data, waStatus: wa.status, waPhone: wa.phone });
  } catch (err) {
    console.error('[dashboard summary]', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
}

export async function usage(req, res) {
  try {
    const data = await usageService.getUsage24h(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[dashboard usage]', err);
    res.status(500).json({ error: 'Error al obtener uso' });
  }
}

export async function chartDaily(req, res) {
  try {
    const data = await dashboardService.getDailyChart(req.user.id, 30);
    res.json(data);
  } catch (err) {
    console.error('[dashboard chartDaily]', err);
    res.status(500).json({ error: 'Error al obtener gráfico diario' });
  }
}

export async function statusDistribution(req, res) {
  try {
    const data = await dashboardService.getStatusDistribution(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[dashboard statusDistribution]', err);
    res.status(500).json({ error: 'Error al obtener distribución' });
  }
}

export async function recentLogs(req, res) {
  try {
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const data = await dashboardService.getRecentLogs(req.user.id, limit);
    res.json(data);
  } catch (err) {
    console.error('[dashboard recentLogs]', err);
    res.status(500).json({ error: 'Error al obtener logs recientes' });
  }
}
