import api from '../services/api.js';

export async function downloadCampaignExport(campaignId) {
  const { data } = await api.get(`/api/campaigns/${campaignId}/export`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `campaign-${campaignId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
