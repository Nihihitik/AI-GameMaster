import { getDocker } from "@/lib/docker/client";

export interface ContainerStat {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpuPct: number;
  memUsage: number;
  memLimit: number;
  memPct: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
  uptimeMs: number | null;
}

const CONTAINER_PATTERN = process.env.LOGS_CONTAINER_PATTERN ?? "^gamemaster-";

interface DockerNetwork {
  rx_bytes?: number;
  tx_bytes?: number;
}

interface BlkioServiceBytesRecursive {
  op?: string;
  value?: number;
}

interface DockerStatsLike {
  cpu_stats?: {
    cpu_usage?: { total_usage?: number; percpu_usage?: number[] };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: { usage?: number; limit?: number };
  networks?: Record<string, DockerNetwork>;
  blkio_stats?: { io_service_bytes_recursive?: BlkioServiceBytesRecursive[] | null };
}

function calcCpuPct(s: DockerStatsLike): number {
  const cur = s.cpu_stats?.cpu_usage?.total_usage ?? 0;
  const prev = s.precpu_stats?.cpu_usage?.total_usage ?? 0;
  const cpuDelta = cur - prev;
  const sysCur = s.cpu_stats?.system_cpu_usage ?? 0;
  const sysPrev = s.precpu_stats?.system_cpu_usage ?? 0;
  const sysDelta = sysCur - sysPrev;
  const online = s.cpu_stats?.online_cpus || s.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
  if (sysDelta <= 0 || cpuDelta <= 0) return 0;
  return (cpuDelta / sysDelta) * online * 100;
}

function sumNetwork(s: DockerStatsLike): { rx: number; tx: number } {
  const networks = s.networks ?? {};
  let rx = 0;
  let tx = 0;
  for (const net of Object.values(networks)) {
    rx += net.rx_bytes ?? 0;
    tx += net.tx_bytes ?? 0;
  }
  return { rx, tx };
}

function sumBlockIo(s: DockerStatsLike): { read: number; write: number } {
  const items = s.blkio_stats?.io_service_bytes_recursive ?? [];
  let read = 0;
  let write = 0;
  for (const item of items ?? []) {
    if (!item) continue;
    if (item.op === "Read" || item.op === "read") read += item.value ?? 0;
    else if (item.op === "Write" || item.op === "write") write += item.value ?? 0;
  }
  return { read, write };
}

export async function collectContainerStats(): Promise<ContainerStat[]> {
  const docker = getDocker();
  const pattern = new RegExp(CONTAINER_PATTERN);
  const list = await docker.listContainers({ all: true });
  const wanted = list.filter((c) => {
    const name = (c.Names?.[0] ?? "").replace(/^\//, "");
    return pattern.test(name);
  });

  const results = await Promise.all(
    wanted.map(async (info): Promise<ContainerStat> => {
      const name = (info.Names?.[0] ?? info.Id).replace(/^\//, "");
      const baseStat: ContainerStat = {
        id: info.Id.slice(0, 12),
        name,
        image: info.Image,
        state: info.State,
        status: info.Status,
        cpuPct: 0,
        memUsage: 0,
        memLimit: 0,
        memPct: 0,
        netRx: 0,
        netTx: 0,
        blockRead: 0,
        blockWrite: 0,
        uptimeMs: null,
      };

      if (info.State !== "running") {
        return baseStat;
      }

      try {
        const container = docker.getContainer(info.Id);
        const stats = (await container.stats({ stream: false })) as unknown as DockerStatsLike;
        const memUsage = stats.memory_stats?.usage ?? 0;
        const memLimit = stats.memory_stats?.limit ?? 0;
        const memPct = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;
        const { rx, tx } = sumNetwork(stats);
        const { read, write } = sumBlockIo(stats);

        let uptimeMs: number | null = null;
        try {
          const inspect = await container.inspect();
          const startedAt = inspect.State?.StartedAt;
          if (startedAt) {
            const t = Date.parse(startedAt);
            if (!Number.isNaN(t)) uptimeMs = Date.now() - t;
          }
        } catch {
          // ignore inspect failure
        }

        return {
          ...baseStat,
          cpuPct: calcCpuPct(stats),
          memUsage,
          memLimit,
          memPct,
          netRx: rx,
          netTx: tx,
          blockRead: read,
          blockWrite: write,
          uptimeMs,
        };
      } catch {
        return baseStat;
      }
    }),
  );

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
