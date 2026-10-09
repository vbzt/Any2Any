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

o formato é escolhido por arquivo. o conversor processa a fila sequencialmente e mantém os resultados disponíveis para download individual. uma falha não interrompe os outros arquivos. arquivos com o mesmo nome são tratados separadamente. ao escolher o formato atual, os streams são copiados sem recodificação; jpg e jpeg são reconhecidos como o mesmo formato. em vídeos com saída diferente, o site inspeciona os codecs e copia cada stream compatível com o destino, recodificando apenas os incompatíveis. se a cópia falhar, tenta a transcodificação com um motor novo.

## limites

- até 200 mb por arquivo; o navegador pode esgotar a memória mesmo abaixo desse limite.
- arquivos grandes levam mais tempo e dependem da capacidade do dispositivo.
- a compatibilidade depende do codec do arquivo, além da extensão. arquivos corrompidos ou codecs não suportados exibem erro.
- imagens animadas são convertidas pelo primeiro quadro; transparência pode ser perdida ao converter para jpg.
- a conversão pode alterar qualidade e metadados. vídeos são ajustados para dimensões pares quando necessário.
- downloads ficam disponíveis enquanto a página está aberta. limpar a fila ou mudar o formato libera o resultado anterior.

## motor e hospedagem

`@ffmpeg/core` e `@ffmpeg/core-mt` 0.12.10 são copiados de `node_modules` para `public/ffmpeg` antes de iniciar o desenvolvimento ou gerar o build. a pasta é gerada e não deve ser versionada. os arquivos js, wasm e o worker de `ffmpeg/mt` são incluídos em `dist` e precisam ser servidos com a aplicação.

os motores são carregados sob demanda, com apenas uma instância ativa. vídeos usam multithread quando há isolamento de origem, SharedArrayBuffer e pelo menos 4 núcleos lógicos; dispositivos que informam menos de 4 gb de memória usam single-thread. a decodificação, os filtros e a codificação de vídeo recebem até 4 threads por etapa. imagens e áudio continuam usando single-thread inicialmente; um motor multithread já carregado pode ser reaproveitado pela fila.

se o multithread falhar ao carregar ou sofrer erro de execução, a conversão tenta o single-thread e mantém essa alternativa pelo restante da visita. uma falha de arquivo encerra o motor antes da próxima tentativa, sem reutilizar uma instância inválida. cada variante de wasm tem aproximadamente 31 mb; trocar de single-thread para multithread exige carregar a segunda variante.

Vite e vercel.json configuram Cross-Origin-Opener-Policy: same-origin e Cross-Origin-Embedder-Policy: require-corp para habilitar memória compartilhada. em outra hospedagem, configure esses cabeçalhos nas respostas; sem eles, a aplicação funciona com single-thread. recursos externos precisam permitir CORS ou CORP.

a cópia entre contêineres é conservadora: H.264 em yuv420p/yuvj420p e AAC para MP4/MOV/MKV; VP8/VP9 e Opus/Vorbis para WebM. os demais streams são recodificados. não usa WebCodecs nem envia arquivos ao servidor.

o deploy é estático. não há login, backend ou persistência da fila.

na Vercel, use o preset Vite, comando de build npm run build e diretório de saída dist. o prebuild inclui o motor de conversão automaticamente. para hospedagem estática manual, publique toda a pasta dist, incluindo assets e ffmpeg.

## desenvolvimento

a interface usa react, typescript, vite e css próprio. a fila está em `src/hooks/useConverter.ts`, as regras de arquivos em `src/lib/files.ts` e o motor em `src/lib/converter.ts`.

os testes do playwright geram imagens, áudio pcm e vídeo webm localmente e exercitam a aplicação compilada, além de regressões de imagens e recuperação do motor no servidor de desenvolvimento. o teste de falha fatal injeta um erro de wasm no primeiro motor e verifica a conversão seguinte e a nova tentativa com o motor real. nenhum arquivo pessoal é usado.

para comparar os caminhos de vídeo, inicie npm run dev e execute npm run bench:video. se a prévia usar outra porta, passe a URL: npm run bench:video -- http://127.0.0.1:5183. esse comando precisa do servidor de desenvolvimento, pois importa os módulos do conversor.

o benchmark gera MOV e WebM sintéticos de 1280 × 720, 24 fps e 4 segundos com áudio. aquece cada caminho e registra três amostras, incluindo escrita, probe quando aplicável, execução e leitura do resultado; o carregamento inicial do motor fica fora da medição. resultados variam conforme navegador e dispositivo.

licença [MIT](LICENSE).
