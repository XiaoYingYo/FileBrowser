async function loadDisks() {
  try {
    document.getElementById('path-input').value = '此电脑';
    const [disksResponse, diskTemplateResponse] = await Promise.all([fetch('/api/disks'), fetch('./tpl/viewMode/disk.html')]);
    if (!disksResponse.ok) {
      throw new Error(`HTTP error! status: ${disksResponse.status}`);
    }
    if (!diskTemplateResponse.ok) {
      throw new Error(`HTTP error! status: ${diskTemplateResponse.status}`);
    }
    const disks = await disksResponse.json();
    const diskViewTemplate = await diskTemplateResponse.text();
    const diskItemTemplate = diskViewTemplate.match(/<for>([\s\S]*?)<\/for>/)[1].trim();

    let allDisksHtml = '';
    disks.forEach((disk) => {
      const usedSpace = disk.totalSpace - disk.freeSpace;
      const usedPercentage = (usedSpace / disk.totalSpace) * 100;
      allDisksHtml += diskItemTemplate.replace('{{diskType}}', disk.type).replace('{{diskPath}}', disk.path.slice(0, 2)).replace('{{usedPercentage}}', usedPercentage.toFixed(2)).replace('{{freeSpace}}', formatBytes(disk.freeSpace)).replace('{{totalSpace}}', formatBytes(disk.totalSpace));
    });

    const finalHtml = diskViewTemplate.replace(/<for>[\s\S]*?<\/for>/, allDisksHtml);

    const mainContent = document.querySelector('main');
    mainContent.innerHTML = finalHtml;

    const diskElements = mainContent.querySelectorAll('.cursor-pointer');
    diskElements.forEach((element, index) => {
      element.addEventListener('dblclick', async () => {
        await loadFiles(disks[index].path);
      });
    });
    document.getElementById('item-count').textContent = `${disks.length} 个项目 |`;
  } catch (error) {
    console.error('Error fetching disk data:', error);
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  await loadDisks();

  const pathInput = document.getElementById('path-input');
  const backButton = document.getElementById('back-button');
  const refreshButton = document.getElementById('refresh-button');

  backButton.addEventListener('click', async () => {
    const currentPath = pathInput.value;
    const lastSlashIndex = currentPath.lastIndexOf('\\');

    if (lastSlashIndex < 3 && currentPath.includes(':\\')) {
      await loadDisks();
    } else {
      const parentPath = currentPath.substring(0, lastSlashIndex);
      if (parentPath) {
        await loadFiles(parentPath);
      } else {
        await loadDisks();
      }
    }
  });

  refreshButton.addEventListener('click', async () => {
    const currentPath = pathInput.value;
    if (currentPath && currentPath !== '此电脑') {
      await loadFiles(currentPath);
    }
  });

  pathInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      const newPath = pathInput.value;
      if (newPath && newPath.trim() !== '' && newPath !== '此电脑') {
        await loadFiles(newPath);
      } else {
        await loadDisks();
      }
    }
  });
});

async function loadFiles(path) {
  try {
    document.getElementById('path-input').value = path;
    const [filesResponse, listTemplateResponse] = await Promise.all([fetch(`/api/files?path=${encodeURIComponent(path)}`), fetch('./tpl/viewMode/list.html')]);
    if (!filesResponse.ok) {
      throw new Error(`HTTP error! status: ${filesResponse.status}`);
    }
    if (!listTemplateResponse.ok) {
      throw new Error(`HTTP error! status: ${listTemplateResponse.status}`);
    }
    const files = await filesResponse.json();
    let listTemplate = await listTemplateResponse.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(listTemplate, 'text/html');
    const newListContent = doc.querySelector('.w-full');

    const mainContent = document.querySelector('main');
    mainContent.innerHTML = '';
    mainContent.appendChild(newListContent);

    const fileListContainer = mainContent.querySelector('.divide-y');
    const fileTemplate = fileListContainer.querySelector('for').innerHTML.trim();
    fileListContainer.innerHTML = '';

    files.forEach((file) => {
      let fileElementHtml = fileTemplate;
      
      // Handle icons based on file type
      if (file.isSymbolicLink) {
        fileElementHtml = fileElementHtml.replace('{{icon}}', 'link').replace('{{iconColor}}', 'text-cyan-400');
      } else if (file.isDirectory) {
        fileElementHtml = fileElementHtml.replace('{{icon}}', 'folder').replace('{{iconColor}}', 'text-yellow-500');
      } else {
        fileElementHtml = fileElementHtml.replace('{{icon}}', 'description').replace('{{iconColor}}', 'text-gray-400');
      }

      // Handle hidden files styling
      fileElementHtml = fileElementHtml.replace('{{extraClasses}}', file.isHidden ? 'opacity-50' : '');
      
      // Handle other placeholders
      fileElementHtml = fileElementHtml.replace('{{fileName}}', file.name);
      fileElementHtml = fileElementHtml.replace('{{lastModified}}', new Date(file.lastModified).toLocaleString());
      fileElementHtml = fileElementHtml.replace('{{fileSize}}', file.isDirectory ? '' : formatBytes(file.size));
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = fileElementHtml;
      const fileElement = tempDiv.firstElementChild;

      if (file.isDirectory) {
        fileElement.addEventListener('dblclick', async () => {
          await loadFiles(file.path);
        });
      }
      
      fileListContainer.appendChild(fileElement);
    });
    document.getElementById('item-count').textContent = `${files.length} 个项目 |`;
  } catch (error) {
    console.error('Error fetching files:', error);
  }
}

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
