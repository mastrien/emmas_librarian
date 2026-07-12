import re

with open('emmas_librarian/dist-electron/ipc/ipcRegistries.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the JS preamble
content = re.sub(r'"use strict";\n.*Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\nexports\.setupIpcRegistries = setupIpcRegistries;\n', '', content, flags=re.DOTALL)
content = re.sub(r'var __importDefault.*?\n};\n', '', content, flags=re.DOTALL)

# Re-add TS imports
imports = """// @ts-nocheck
import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { QueryTranslator, queryTranslator } from '../services/QueryTranslator';
import { ApiIntegrator } from '../services/ApiIntegrator';
import { ExportService } from '../services/ExportService';
import { AIService } from '../services/AIService';
import { SyncService } from '../database/SyncService';
import { BackupService } from '../services/BackupService';
import { IpcChannel, QueryASTNode, Article } from '../types';
import { QueryBlock } from '../services/types';
import { setupAiIpcHandlers } from './aiIpcHandlers';

"""

# Replace all requires
content = re.sub(r'const .*? = require\(.*?\);\n', '', content)
content = re.sub(r'const .*? = __importDefault\(require\(.*?\)\);\n', '', content)

# Fix variables
content = content.replace('electron_1.ipcMain', 'ipcMain')
content = content.replace('electron_1.app', 'app')
content = content.replace('electron_1.BrowserWindow', 'BrowserWindow')
content = content.replace('electron_1.dialog', 'dialog')
content = content.replace('electron_1.shell', 'shell')

content = content.replace('fs_1.default.', 'fs.')
content = content.replace('path_1.default.', 'path.')
content = content.replace('types_1.IpcChannel', 'IpcChannel')

content = content.replace('DatabaseAdapter_1.DatabaseAdapter', 'DatabaseAdapter')
content = content.replace('BackupService_1.BackupService', 'BackupService')
content = content.replace('QueryTranslator_1.QueryTranslator', 'QueryTranslator')
content = content.replace('QueryTranslator_1.queryTranslator', 'queryTranslator')
content = content.replace('ApiIntegrator_1.ApiIntegrator', 'ApiIntegrator')
content = content.replace('SearchOrchestrator_1.SearchOrchestrator', 'SearchOrchestrator')
content = content.replace('ExportService_1.ExportService', 'ExportService')
content = content.replace('AIService_1.AIService', 'AIService')
content = content.replace('SyncService_1.SyncService', 'SyncService')

# Output
final_code = imports + content.strip() + "\n"

# Add setupAiIpcHandlers injection
# Find: const aiService = new AIService(db);
final_code = final_code.replace("const aiService = new AIService(db);", "const aiService = new AIService(db);\n    setupAiIpcHandlers(db, aiService);")

with open('emmas_librarian/electron/ipc/ipcRegistries.ts', 'w', encoding='utf-8') as f:
    f.write(final_code)

print("Successfully un-transpiled.")
