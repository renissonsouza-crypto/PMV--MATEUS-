import vitoriaDoisOlhos from "../../assets/hero/vitoria-dois-olhos-1.jpg";
import vitoriaTerceiraPonte from "../../assets/hero/vitoria-terceira-ponte-noturna.jpg";
import qualificavixPanificacao from "../../assets/hero/qualificavix-paes-bolos-saudaveis.jpg";
import qualificavixEletricista from "../../assets/hero/qualificavix-eletricista-predial.jpg";
import qualificavixMecanica from "../../assets/hero/qualificavix-manutencao-automotiva.jpg";

export type HeroImage = {
  id: string;
  src: string;
  srcSet?: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  credit: string;
  sourceUrl?: string;
  desktopPosition: string;
  mobilePosition: string;
};

/** Real photographs; source and author stay attached to each slide. */
export const HERO_IMAGES: HeroImage[] = [
  {
    id: "vitoria-dois-olhos",
    src: vitoriaDoisOlhos,
    width: 4000, height: 3000,
    alt: "Panorama de Vitória visto da Pedra dos Dois Olhos, com a cidade e a baía ao fundo",
    caption: "Vitória vista da Pedra dos Dois Olhos",
    credit: "Rafael Deminicis · CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Vista_da_cidade_de_Vit%C3%B3ria_ES_a_partir_da_Pedra_dos_Dois_Olhos_1.jpg",
    desktopPosition: "center 55%",
    mobilePosition: "58% center",
  },
  {
    id: "qualificavix-panificacao",
    src: qualificavixPanificacao,
    width: 1600, height: 1066,
    alt: "Instrutora e participantes apresentam pães e bolos preparados em uma formação do SENAC",
    caption: "QualificaVix · Pães e Bolos Saudáveis",
    credit: "Leonardo Silveira / Prefeitura de Vitória",
    sourceUrl: "https://www.vitoria.es.gov.br/noticia/qualificacao-vitoria-oferta-mais-de-100-vagas-em-7-cursos-profissionalizantes-gratuitos-57449",
    desktopPosition: "center 42%",
    mobilePosition: "55% center",
  },
  {
    id: "vitoria-terceira-ponte",
    src: vitoriaTerceiraPonte,
    width: 4960, height: 3307,
    alt: "Terceira Ponte iluminada e vista noturna da cidade de Vitória",
    caption: "Vitória à noite · Terceira Ponte",
    credit: "Vitor Jubini / Ministério do Turismo",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:VitorJubini_TerceiraPonte_Vitoria_ES_(27121005458).jpg",
    desktopPosition: "center 60%",
    mobilePosition: "58% 62%",
  },
  {
    id: "qualificavix-eletricista",
    src: qualificavixEletricista,
    width: 1600, height: 1066,
    alt: "Prática de eletricista predial com circuito, lâmpada e multímetro",
    caption: "QualificaVix · Prática de eletricista predial",
    credit: "Leonardo Silveira / Prefeitura de Vitória",
    sourceUrl: "https://www.vitoria.es.gov.br/noticia/vixcursos-abre-270-vagas-em-qualificacao-profissional-com-estreia-do-ensino-online-57023",
    desktopPosition: "center 55%",
    mobilePosition: "28% center",
  },
  {
    id: "qualificavix-mecanica",
    src: qualificavixMecanica,
    width: 1600, height: 1065,
    alt: "Veículo e equipamentos utilizados na unidade móvel de qualificação automotiva do SENAI",
    caption: "QualificaVix · Formação em manutenção automotiva",
    credit: "Jansen Lube / Prefeitura de Vitória",
    sourceUrl: "https://www.vitoria.es.gov.br/noticia/ainda-da-tempo-cursos-do-qualificavix-tem-vagas-abertas-com-inicio-das-aulas-em-outubro-57433",
    desktopPosition: "center 48%",
    mobilePosition: "65% center",
  },
];
