// src/injected/tools/getUnitRegistrations.ts
// Vérifie les inscriptions officielles aux modules/unités d'enseignement (ex: B-INN-000, G-ENG-500, G-WEB-500)
// Endpoints: GET /units/instances?schoolYear=...&expanded=false (requests.md L562)
// et GET /units/:year/:code/:instance/registrations (requests.md L49)

import { fetchEpitech } from '../utils/api';
import { formatLocalDate } from '../utils/format';
import { getStudentLogin } from '../utils/student';
import { resolveUnitCode } from '../utils/units';

export interface UnitRegistrationsArgs {
  unitCode?: string;
  schoolYear?: number;
}

export async function getUnitRegistrations(args: UnitRegistrationsArgs = {}) {
  const currentYear = new Date().getFullYear();
  const year = args?.schoolYear || currentYear;

  try {
    const res = await fetchEpitech<any>(`/units/instances?schoolYear=${year}&expanded=false`);
    const list: any[] = res?.data || (Array.isArray(res) ? res : []);

    // 1. Si aucun module spécifique n'est demandé : lister TOUS les modules inscrits
    if (!args?.unitCode) {
      const registeredUnits = list.filter((u) => u.isRegistered === true);

      // Regroupement clair pour l'assistant et l'étudiant
      const modulesSemestre = registeredUnits
        .filter((u) => u.unitCode.startsWith('G-') && u.unitCode !== 'G-PRO-500')
        .map((u) => ({
          code: u.unitCode,
          nom: u.name,
          semestre: u.semester,
          instance: u.code || 'LIL-1',
          estInscrit: true
        }));

      const modulesAnnuelsEtHub = registeredUnits
        .filter((u) => u.unitCode.startsWith('B-') || u.unitCode.startsWith('S-'))
        .map((u) => ({
          code: u.unitCode,
          nom: u.name,
          semestre: u.semester,
          instance: u.code || 'LIL-1',
          estInscrit: true
        }));

      const modulesProEtStages = registeredUnits
        .filter((u) => u.unitCode === 'G-PRO-500')
        .map((u) => ({
          code: u.unitCode,
          nom: u.name,
          semestre: u.semester,
          instance: u.code || 'LIL-1',
          estInscrit: true
        }));

      return {
        anneeScolaire: year,
        totalModulesInscrits: registeredUnits.length,
        modulesSemestreEnCours: modulesSemestre,
        modulesAnnuelsEtHub: modulesAnnuelsEtHub,
        modulesProfessionnelsEtStages: modulesProEtStages,
        listeComplete: registeredUnits.map((u) => ({
          code: u.unitCode,
          nom: u.name,
          semestre: u.semester,
          instance: u.code || 'LIL-1'
        }))
      };
    }

    // 2. Si un module spécifique est demandé (par code ou par nom, ex: "Innovation Hub", "B-INN-000")
    const rawSearch = args.unitCode.trim();
    const resolvedCode = await resolveUnitCode(rawSearch);
    const searchLower = rawSearch.toLowerCase();
    const resolvedLower = resolvedCode.toLowerCase();

    // Recherche dans la liste des instances de l'année
    const foundUnit = list.find((u) => {
      const codeMatch = u.unitCode?.toLowerCase() === resolvedLower || u.unitCode?.toLowerCase() === searchLower;
      const nameMatch = u.name?.toLowerCase().includes(searchLower);
      return codeMatch || nameMatch;
    });

    if (!foundUnit) {
      return {
        recherche: rawSearch,
        annee: year,
        message: `Aucun module correspondant à "${rawSearch}" n'a été trouvé pour l'année scolaire ${year}.`
      };
    }

    const unitCode = foundUnit.unitCode;
    const instanceCode = foundUnit.code || 'LIL-1';
    const isRegistered = foundUnit.isRegistered === true;

    // Récupération des détails d'inscription (date précise, camarades inscrits)
    let myRegDate: string | null = null;
    let totalInscritsPromo: number = foundUnit.registrationsCount || 0;
    let camarades: string[] = [];

    try {
      const regs = await fetchEpitech<any[]>(`/units/${year}/${unitCode}/${instanceCode}/registrations`);
      if (Array.isArray(regs)) {
        totalInscritsPromo = regs.length;
        const myLogin = await getStudentLogin();
        const myReg = regs.find((r) => r.student?.login === myLogin);
        if (myReg?.createdAt) {
          myRegDate = formatLocalDate(myReg.createdAt);
        }
        camarades = regs
          .filter((r) => r.student?.login !== myLogin)
          .slice(0, 25)
          .map((r) => `${r.student?.firstname} ${r.student?.lastname}`);
      }
    } catch {
      // Les détails de promo sont facultatifs si la route de registrations est restreinte
    }

    return {
      module: unitCode,
      nom: foundUnit.name,
      semestre: foundUnit.semester,
      instance: instanceCode,
      annee: year,
      estInscrit: isRegistered,
      dateInscription: myRegDate,
      debut: foundUnit.startDate ? formatLocalDate(foundUnit.startDate) : null,
      fin: foundUnit.endDate ? formatLocalDate(foundUnit.endDate) : null,
      dateLimiteInscription: foundUnit.endRegistrationDate ? formatLocalDate(foundUnit.endRegistrationDate) : null,
      totalInscritsPromo: totalInscritsPromo,
      camaradesInscrits: camarades
    };
  } catch (err: any) {
    return { error: `Erreur lors de la vérification du module ${args.unitCode || ''} : ${err.message}` };
  }
}
