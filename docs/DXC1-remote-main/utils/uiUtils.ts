
export const getAvatarColor = (name: string) => {
    if (!name) return 'bg-zinc-800';
    // 使用更深、更符合"暗色监视器"风格的色系，避免过亮刺眼
    const colors = [
        'bg-slate-800', 'bg-zinc-800', 'bg-stone-800', // 中性灰
        'bg-red-900', 'bg-orange-900', 'bg-amber-900', // 暖色系（深色）
        'bg-green-900', 'bg-emerald-900', 'bg-teal-900', // 绿色系（深色）
        'bg-cyan-900', 'bg-sky-900', 'bg-blue-900', // 蓝色系（深色）
        'bg-indigo-900', 'bg-violet-900', 'bg-purple-900', // 紫色系（深色）
        'bg-fuchsia-900', 'bg-pink-900', 'bg-rose-900' // 粉色系（深色）
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};
