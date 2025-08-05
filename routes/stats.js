import express from 'express';
import ApiStat from '../models/ApiStat.js';
import { authenticateApiKey, authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// Endpoint nhận dữ liệu từ SillyTavern
router.post('/api-info', authenticateApiKey, async (req, res) => {
    try {
        const apiStat = new ApiStat(req.body);
        await apiStat.save();
        res.status(201).json({ message: 'API info saved successfully' });
    } catch (error) {
        console.error('Error saving API info:', error);
        res.status(500).json({ error: 'Failed to save API info' });
    }
});

// Thống kê tổng quan
router.get('/overview', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const totalRequests = await ApiStat.countDocuments(filter);
        
        const uniqueUsers = await ApiStat.distinct('handle', filter);
        
        const topSources = await ApiStat.aggregate([
            { $match: filter },
            { $group: { _id: '$chatCompletionSource', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        const topPaths = await ApiStat.aggregate([
            { $match: filter },
            { $group: { _id: '$path', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        res.json({
            totalRequests,
            uniqueUsers: uniqueUsers.length,
            topSources,
            topPaths
        });
    } catch (error) {
        console.error('Error getting overview:', error);
        res.status(500).json({ error: 'Failed to get overview' });
    }
});

// Thống kê theo handle
router.get('/by-handle', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, startDate, endDate } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const stats = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$handle',
                    totalRequests: { $sum: 1 },
                    lastActivity: { $max: '$timestamp' },
                    sources: { $addToSet: '$chatCompletionSource' },
                    paths: { $addToSet: '$path' }
                }
            },
            { $sort: { totalRequests: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: parseInt(limit) }
        ]);
        
        const total = await ApiStat.aggregate([
            { $match: filter },
            { $group: { _id: '$handle' } },
            { $count: 'total' }
        ]);
        
        res.json({
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Error getting stats by handle:', error);
        res.status(500).json({ error: 'Failed to get stats by handle' });
    }
});

// Thống kê theo source
router.get('/by-source', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const stats = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$chatCompletionSource',
                    totalRequests: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$handle' },
                    lastActivity: { $max: '$timestamp' }
                }
            },
            {
                $project: {
                    _id: 1,
                    totalRequests: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    lastActivity: 1
                }
            },
            { $sort: { totalRequests: -1 } }
        ]);
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats by source:', error);
        res.status(500).json({ error: 'Failed to get stats by source' });
    }
});

// Thống kê theo proxy
router.get('/by-proxy', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const filter = { reverseProxy: { $ne: null } };
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const stats = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$reverseProxy',
                    totalRequests: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$handle' },
                    lastActivity: { $max: '$timestamp' }
                }
            },
            {
                $project: {
                    _id: 1,
                    totalRequests: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    lastActivity: 1
                }
            },
            { $sort: { totalRequests: -1 } }
        ]);
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats by proxy:', error);
        res.status(500).json({ error: 'Failed to get stats by proxy' });
    }
});

// Thống kê theo thời gian
router.get('/timeline', authenticateAdmin, async (req, res) => {
    try {
        const { interval = 'hour', startDate, endDate } = req.query;
        
        const filter = {};
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        let dateFormat;
        switch (interval) {
            case 'minute':
                dateFormat = '%Y-%m-%d %H:%M';
                break;
            case 'hour':
                dateFormat = '%Y-%m-%d %H:00';
                break;
            case 'day':
                dateFormat = '%Y-%m-%d';
                break;
            default:
                dateFormat = '%Y-%m-%d %H:00';
        }
        
        const stats = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: dateFormat,
                            date: '$timestamp'
                        }
                    },
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$handle' }
                }
            },
            {
                $project: {
                    _id: 1,
                    count: 1,
                    uniqueUsers: { $size: '$uniqueUsers' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting timeline stats:', error);
        res.status(500).json({ error: 'Failed to get timeline stats' });
    }
});

// Xuất danh sách API keys theo filter
router.get('/api-keys', authenticateAdmin, async (req, res) => {
    try {
        const { 
            filterBy, 
            filterValue, 
            startDate, 
            endDate, 
            page = 1, 
            limit = 50,
            format = 'json' 
        } = req.query;
        
        const filter = {};
        
        // Apply date filter
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        // Apply specific filters
        if (filterBy && filterValue) {
            switch (filterBy) {
                case 'handle':
                    filter.handle = filterValue;
                    break;
                case 'chatCompletionSource':
                    filter.chatCompletionSource = filterValue;
                    break;
                case 'reverseProxy':
                    filter.reverseProxy = { $regex: filterValue, $options: 'i' };
                    break;
                case 'apiKeySource':
                    filter.apiKeySource = filterValue;
                    break;
                case 'path':
                    filter.path = filterValue;
                    break;
            }
        }
        
        // Only get records with API keys
        filter.apiKey = { $ne: null, $ne: '' };
        
        const pipeline = [
            { $match: filter },
            {
                $group: {
                    _id: {
                        apiKey: '$apiKey',
                        handle: '$handle',
                        chatCompletionSource: '$chatCompletionSource',
                        reverseProxy: '$reverseProxy',
                        apiKeySource: '$apiKeySource'
                    },
                    firstUsed: { $min: '$timestamp' },
                    lastUsed: { $max: '$timestamp' },
                    totalUsage: { $sum: 1 },
                    paths: { $addToSet: '$path' },
                    secretKeys: { $addToSet: '$secretKey' }
                }
            },
            {
                $project: {
                    _id: 0,
                    apiKey: '$_id.apiKey',
                    handle: '$_id.handle',
                    chatCompletionSource: '$_id.chatCompletionSource',
                    reverseProxy: '$_id.reverseProxy',
                    apiKeySource: '$_id.apiKeySource',
                    firstUsed: 1,
                    lastUsed: 1,
                    totalUsage: 1,
                    paths: 1,
                    secretKeys: 1,
                    maskedApiKey: '$_id.apiKey'
                }
            },
            { $sort: { lastUsed: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: parseInt(limit) }
        ];
        
        const apiKeys = await ApiStat.aggregate(pipeline);
        
        // Count total for pagination
        const countPipeline = [
            { $match: filter },
            {
                $group: {
                    _id: {
                        apiKey: '$apiKey',
                        handle: '$handle',
                        chatCompletionSource: '$chatCompletionSource',
                        reverseProxy: '$reverseProxy'
                    }
                }
            },
            { $count: 'total' }
        ];
        
        const totalCount = await ApiStat.aggregate(countPipeline);
        const total = totalCount[0]?.total || 0;
        
        if (format === 'csv') {
            // Export as CSV
            const csv = convertToCSV(apiKeys);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=api-keys.csv');
            return res.send(csv);
        }
        
        res.json({
            data: apiKeys,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            },
            filters: {
                filterBy,
                filterValue,
                startDate,
                endDate
            }
        });
        
    } catch (error) {
        console.error('Error getting API keys:', error);
        res.status(500).json({ error: 'Failed to get API keys' });
    }
});

// Thống kê chi tiết theo API key cụ thể
router.get('/api-key-details/:apiKey', authenticateAdmin, async (req, res) => {
    try {
        const { apiKey } = req.params;
        const { startDate, endDate } = req.query;
        
        const filter = { apiKey };
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const stats = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    uniqueHandles: { $addToSet: '$handle' },
                    uniqueSources: { $addToSet: '$chatCompletionSource' },
                    uniqueProxies: { $addToSet: '$reverseProxy' },
                    uniquePaths: { $addToSet: '$path' },
                    firstUsed: { $min: '$timestamp' },
                    lastUsed: { $max: '$timestamp' },
                    apiKeySource: { $first: '$apiKeySource' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalRequests: 1,
                    uniqueHandles: { $size: '$uniqueHandles' },
                    uniqueSources: { $size: '$uniqueSources' },
                    uniqueProxies: { $size: '$uniqueProxies' },
                    uniquePaths: { $size: '$uniquePaths' },
                    firstUsed: 1,
                    lastUsed: 1,
                    apiKeySource: 1,
                    handles: '$uniqueHandles',
                    sources: '$uniqueSources',
                    proxies: '$uniqueProxies',
                    paths: '$uniquePaths'
                }
            }
        ]);
        
        // Usage timeline
        const timeline = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d %H:00',
                            date: '$timestamp'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        res.json({
            apiKey: req.params.apiKey,
            stats: stats[0] || {},
            timeline
        });
        
    } catch (error) {
        console.error('Error getting API key details:', error);
        res.status(500).json({ error: 'Failed to get API key details' });
    }
});

// Thống kê API keys bị duplicate
router.get('/duplicate-api-keys', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const filter = { apiKey: { $ne: null, $ne: '' } };
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const duplicates = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$apiKey',
                    handles: { $addToSet: '$handle' },
                    sources: { $addToSet: '$chatCompletionSource' },
                    proxies: { $addToSet: '$reverseProxy' },
                    totalUsage: { $sum: 1 },
                    firstSeen: { $min: '$timestamp' },
                    lastSeen: { $max: '$timestamp' }
                }
            },
            {
                $match: {
                    $or: [
                        { 'handles.1': { $exists: true } }, // More than 1 handle
                        { 'sources.1': { $exists: true } }  // More than 1 source
                    ]
                }
            },
            {
                $project: {
                    apiKey: '$_id',
                    maskedApiKey: '$_id',
                    handleCount: { $size: '$handles' },
                    sourceCount: { $size: '$sources' },
                    proxyCount: { $size: '$proxies' },
                    handles: 1,
                    sources: 1,
                    proxies: 1,
                    totalUsage: 1,
                    firstSeen: 1,
                    lastSeen: 1
                }
            },
            { $sort: { totalUsage: -1 } }
        ]);
        
        res.json(duplicates);
        
    } catch (error) {
        console.error('Error getting duplicate API keys:', error);
        res.status(500).json({ error: 'Failed to get duplicate API keys' });
    }
});

// Thống kê top API keys
router.get('/top-api-keys', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate, limit = 20 } = req.query;
        
        const filter = { apiKey: { $ne: null, $ne: '', $exists: true } };
        if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const topKeys = await ApiStat.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$apiKey',
                    totalUsage: { $sum: 1 },
                    uniqueHandles: { $addToSet: '$handle' },
                    uniqueSources: { $addToSet: '$chatCompletionSource' },
                    lastUsed: { $max: '$timestamp' },
                    apiKeySource: { $first: '$apiKeySource' }
                }
            },
            {
                $match: {
                    _id: { $ne: null, $ne: '' }
                }
            },
            {
                $project: {
                    apiKey: '$_id',
                    maskedApiKey: '$_id',
                    totalUsage: 1,
                    uniqueHandles: { $size: '$uniqueHandles' },
                    uniqueSources: { $size: '$uniqueSources' },
                    lastUsed: 1,
                    apiKeySource: 1
                }
            },
            { $sort: { totalUsage: -1 } },
            { $limit: parseInt(limit) }
        ]);
        
        res.json(topKeys);
        
    } catch (error) {
        console.error('Error getting top API keys:', error);
        res.status(500).json({ error: 'Failed to get top API keys' });
    }
});

// Helper function to convert data to CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = [
        'API Key',
        'Handle',
        'Source',
        'Reverse Proxy',
        'Key Source',
        'Total Usage',
        'First Used',
        'Last Used',
        'Paths',
        'Secret Keys'
    ];
    
    const rows = data.map(item => [
        item.maskedApiKey || '',
        item.handle || '',
        item.chatCompletionSource || '',
        item.reverseProxy || '',
        item.apiKeySource || '',
        item.totalUsage || 0,
        item.firstUsed ? new Date(item.firstUsed).toISOString() : '',
        item.lastUsed ? new Date(item.lastUsed).toISOString() : '',
        (item.paths || []).join(';'),
        (item.secretKeys || []).join(';')
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
        
    return csvContent;
}

export default router;