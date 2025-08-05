import mongoose from 'mongoose';

const apiStatSchema = new mongoose.Schema({
  handle: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  path: {
    type: String,
    required: true,
    index: true
  },
  reverseProxy: {
    type: String,
    index: true
  },
  proxyPassword: {
    type: String
  },
  chatCompletionSource: {
    type: String,
    index: true
  },
  apiKey: {
    type: String
  },
  secretKey: {
    type: String
  },
  apiKeySource: {
    type: String,
    enum: ['proxy_password', 'secret_file', 'error', null]
  }
}, {
  timestamps: true
});

// Index compound cho query hiệu quả
apiStatSchema.index({ timestamp: -1, handle: 1 });
apiStatSchema.index({ chatCompletionSource: 1, timestamp: -1 });
apiStatSchema.index({ reverseProxy: 1, timestamp: -1 });

export default mongoose.model('ApiStat', apiStatSchema);