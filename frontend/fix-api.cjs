const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      const regex = /api\.(get|post|put|delete|patch)\(['"`](\/[^'"`]+)['"`]/g;
      content = content.replace(regex, (match, method, url) => {
        if (!url.startsWith('/api/v1')) {
          modified = true;
          let newUrl = '/api/v1' + url;
          if (url === '/customers') newUrl = '/api/v1/master-data/customers';
          if (url === '/products') newUrl = '/api/v1/master-data/products';
          if (url === '/warehouses') newUrl = '/api/v1/master-data/warehouses';
          if (url === '/inventory/stock-transfers') newUrl = '/api/v1/inventory/transfers';
          if (url === '/inventory/stock-opname/initiate') newUrl = '/api/v1/inventory/opname';
          
          const endChar = match[match.length - 1]; // preserve quote char if possible, but actually we are replacing up to the url.
          // Wait, the match includes the opening quote but NOT the closing quote if I don't capture it?
          // Oh, the regex `['"`]` matches the quote.
          return 'api.' + method + '(\'' + newUrl + '\'';
        }
        return match;
      });

      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed APIs in', fullPath);
      }
    }
  }
}
walk('src');
