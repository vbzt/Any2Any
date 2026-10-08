# any2any

conversor gratuito de imagens, áudio e vídeo com processamento no navegador. os arquivos não são enviados a um servidor. o motor de conversão e a fonte são carregados pela rede.

## executar

requer node.js 22 ou superior.

```sh
npm install
npm run dev
```

no powershell, use `npm.cmd` se a política de execução bloquear `npm.ps1`.

```sh
npm run lint
npm run build
npm run preview
npm run test:e2e
```

o teste de navegador usa microsoft edge instalado. para outro navegador chromium instalado, defina `PLAYWRIGHT_CHANNEL=chrome`. para usar o chromium do playwright, ajuste o canal na configuração e instale o navegador correspondente.

## formatos de saída

| entrada | saídas |
| --- | --- |
| imagem | jpg, png, webp |
| áudio | mp3, wav, ogg, aac, flac |
| vídeo | mp4, webm, mov, mkv, mp3 (extração de áudio) |

o formato é escolhido por arquivo. o conversor processa a fila sequencialmente e mantém os resultados disponíveis para download individual. uma falha não interrompe os outros arquivos. arquivos com o mesmo nome são tratados separadamente. ao escolher o formato atual, os streams são copiados sem recodificação; jpg e jpeg são reconhecidos como o mesmo formato.

## limites

- até 200 mb por arquivo; o navegador pode esgotar a memória mesmo abaixo desse limite.
- arquivos grandes levam mais tempo e dependem da capacidade do dispositivo.
- a compatibilidade depende do codec do arquivo, além da extensão. arquivos corrompidos ou codecs não suportados exibem erro.
- imagens animadas são convertidas pelo primeiro quadro; transparência pode ser perdida ao converter para jpg.
- a conversão pode alterar qualidade e metadados. vídeos são ajustados para dimensões pares quando necessário.
- downloads ficam disponíveis enquanto a página está aberta. limpar a fila ou mudar o formato libera o resultado anterior.

## motor e hospedagem

`@ffmpeg/core` 0.12.10 é copiado de `node_modules` para `public/ffmpeg` antes de iniciar o desenvolvimento ou gerar o build. a pasta é gerada e não deve ser versionada. os arquivos js e wasm são incluídos em `dist` e precisam ser servidos com a aplicação.

usa o core single-thread e um worker persistente, carregados sob demanda. após uma falha de conversão, o worker é encerrado e o próximo arquivo carrega uma instância nova para não reutilizar um motor inválido. não exige cabeçalhos de isolamento para memória compartilhada. na primeira conversão, o navegador baixa aproximadamente 31 mb de wasm.

o deploy é estático. não há login, backend ou persistência da fila.

na Vercel, use o preset Vite, comando de build npm run build e diretório de saída dist. o prebuild inclui o motor de conversão automaticamente. para hospedagem estática manual, publique toda a pasta dist, incluindo assets e ffmpeg.

## desenvolvimento

a interface usa react, typescript, vite e css próprio. a fila está em `src/hooks/useConverter.ts`, as regras de arquivos em `src/lib/files.ts` e o motor em `src/lib/converter.ts`.

os testes do playwright geram imagens, áudio pcm e vídeo webm localmente e exercitam a aplicação compilada, além de regressões de imagens e recuperação do motor no servidor de desenvolvimento. o teste de falha fatal injeta um erro de wasm no primeiro motor e verifica a conversão seguinte e a nova tentativa com o motor real. nenhum arquivo pessoal é usado.

licença [MIT](LICENSE).
