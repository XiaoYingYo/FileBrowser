document.addEventListener('DOMContentLoaded', async function () {
  try {
    const [disksResponse, templateResponse] = await Promise.all([fetch('/api/disks'), fetch('./tpl/viewMode/disk.html')]);

    if (!disksResponse.ok) {
      throw new Error(`HTTP error! status: ${disksResponse.status}`);
    }
    if (!templateResponse.ok) {
      throw new Error(`HTTP error! status: ${templateResponse.status}`);
    }

    const disks = await disksResponse.json();
    const template = await templateResponse.text();
    const diskList = document.getElementById('disk-list');
    diskList.innerHTML = ''; // Clear existing content

    disks.forEach((disk) => {
      const usedSpace = disk.totalSpace - disk.freeSpace;
      const usedPercentage = (usedSpace / disk.totalSpace) * 100;

      let diskElementHtml = template.replace('{{diskType}}', disk.type).replace('{{diskPath}}', disk.path.slice(0, 2)).replace('{{usedPercentage}}', usedPercentage.toFixed(2)).replace('{{freeSpace}}', formatBytes(disk.freeSpace)).replace('{{totalSpace}}', formatBytes(disk.totalSpace));

      diskList.innerHTML += diskElementHtml;
    });
  } catch (error) {
    console.error('Error fetching data:', error);
  }
});

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
