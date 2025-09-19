document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/disks')
        .then(response => response.json())
        .then(data => {
            const diskList = document.getElementById('disk-list');
            diskList.innerHTML = ''; // Clear existing content
            data.forEach(disk => {
                const diskElement = document.createElement('div');
                diskElement.className = 'flex items-start p-2 hover:bg-gray-700 rounded-lg cursor-pointer';

                const usedSpace = disk.totalSpace - disk.freeSpace;
                const usedPercentage = (usedSpace / disk.totalSpace) * 100;

                diskElement.innerHTML = `
                    <span class="material-icons text-5xl text-gray-400">storage</span>
                    <div class="ml-3 flex-grow">
                        <p class="text-sm font-medium">${disk.type} (${disk.path.slice(0, 2)})</p>
                        <div class="progress-bar mt-1">
                            <div class="progress-bar-fill" style="width: ${usedPercentage.toFixed(2)}%"></div>
                        </div>
                        <p class="text-xs text-gray-400 mt-1">${formatBytes(disk.freeSpace)} 可用, 共 ${formatBytes(disk.totalSpace)}</p>
                    </div>
                `;
                diskList.appendChild(diskElement);
            });
        })
        .catch(error => console.error('Error fetching disk data:', error));
});

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}